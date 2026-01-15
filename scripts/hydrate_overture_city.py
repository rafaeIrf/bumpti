#!/usr/bin/env python3
"""
Overture Maps City Hydration Script
Fetches POIs from Overture Maps S3 via DuckDB and loads into Supabase with data sanitization.
"""

import sys
import os
import json
import duckdb
import psycopg2
from psycopg2.extras import execute_values
import requests

# Import from hydration modules
from hydration.utils import load_config, build_category_map, sanitize_name
from hydration.validation import validate_category_name, check_taxonomy_hierarchy, filter_osm_red_flags
from hydration.scoring import calculate_scores, apply_scoring_modifiers, calculate_taxonomy_weight
from hydration.ai_matcher import (
    generate_hotlist,
    get_cached_hotlist,
    save_hotlist_to_cache,
    ai_match_iconic_venues
)
from hydration.database import insert_city_to_registry, fetch_city_from_registry


def load_curation_config():
    """Load all curation configurations from JSON files."""
    config_dir = os.path.join(os.path.dirname(__file__), '..', 'config', 'curation')
    
    with open(os.path.join(config_dir, 'categories.json'), 'r', encoding='utf-8') as f:
        categories_config = json.load(f)
    
    with open(os.path.join(config_dir, 'names.json'), 'r', encoding='utf-8') as f:
        names_config = json.load(f)
    
    with open(os.path.join(config_dir, 'taxonomy_rules.json'), 'r', encoding='utf-8') as f:
        taxonomy_config = json.load(f)
    
    return {
        'categories': categories_config,
        'names': names_config,
        'taxonomy': taxonomy_config
    }


def apply_scoring_modifiers(relevance_score, internal_category, overture_category, config):
    """Apply taxonomic penalties and boosts to relevance score.
    
    Returns: (modified_score, modifier_applied)
    - Penalties: fast_food 0.25x, gas_station 0.15x, etc
    - Boosts: stadium 2.0x, university 1.8x, etc
    """
    modifiers = config.get('categories', {}).get('scoring_modifiers', {})
    if not modifiers:
        return (relevance_score, 1.0)
    
    penalties = modifiers.get('penalties', {})
    boosts = modifiers.get('boosts', {})
    
    modifier = 1.0
    
    # Check PRIMARY TAXONOMY penalties
    taxonomy_primary = penalties.get('taxonomy_primary', {})
    overture_lower = overture_category.lower() if overture_category else ''
    if overture_lower in taxonomy_primary:
        modifier = min(modifier, taxonomy_primary[overture_lower])
    
    # Check HIERARCHY KEYWORD penalties
    taxonomy_keywords = penalties.get('taxonomy_hierarchy_keywords', {})
    for keyword, penalty in taxonomy_keywords.items():
        if keyword in overture_lower:
            modifier = min(modifier, penalty)
    
    # Check INTERNAL CATEGORY boosts (only if no penalty applied)
    if modifier >= 1.0:
        internal_boosts = boosts.get('internal_category', {})
        internal_lower = internal_category.lower() if internal_category else ''
        if internal_lower in internal_boosts:
            modifier = internal_boosts[internal_lower]
    
    modified_score = int(relevance_score * modifier)
    return (modified_score, modifier)


def check_taxonomy_hierarchy(source_raw, categories_primary, categories_alternate, config):
    """Check if POI belongs to forbidden taxonomy branches."""
    forbidden_terms = config['taxonomy']['forbidden_hierarchy_terms']
    
    all_categories = [categories_primary]
    if categories_alternate:
        all_categories.extend(categories_alternate)
    
    for cat in all_categories:
        if cat:
            cat_lower = cat.lower()
            for term in forbidden_terms:
                if term in cat_lower:
                    return False
    
    if source_raw and isinstance(source_raw, dict):
        tags = source_raw.get('tags', {})
        if tags:
            for key, value in tags.items():
                combined = f"{key}:{value}".lower()
                for term in forbidden_terms:
                    if term in combined:
                        return False
    
    return True


def filter_osm_red_flags(source_raw, config):
    """Check OSM source tags for red flags."""
    if not source_raw or not isinstance(source_raw, dict):
        return True
    
    tags = source_raw.get('tags', {})
    if not tags:
        return True
    
    osm_flags = config['taxonomy']['osm_red_flags']
    
    for key, forbidden_values in osm_flags.items():
        tag_value = tags.get(key, '').lower()
        if not tag_value:
            continue
        
        if key == 'healthcare' and tag_value == 'massage':
            massage_type = tags.get('massage', '').lower()
            if massage_type in ['spa', 'sports', 'medical', 'physiotherapy']:
                continue
        
        for forbidden in forbidden_values:
            if forbidden in tag_value:
                return False
    
    return True


def calculate_taxonomy_weight(category, original_category, config):
    """Calculate additional weight based on taxonomy hierarchy."""
    category_lower = category.lower() if category else ''
    original_lower = original_category.lower() if original_category else ''
    combined = f"{category_lower} {original_lower}"
    
    weights = config['taxonomy']['taxonomy_weights']
    
    for weight_type, weight_data in weights.items():
        for cat in weight_data['categories']:
            if cat in combined:
                return weight_data['bonus']
    
    return 0


def finalize_callback(city_id, status, error_msg=None, stats=None):
    """Call Edge Function callback to update cities_registry."""
    url = f"{os.environ['SUPABASE_URL']}/functions/v1/finalize-city-hydration"
    headers = {
        'x-github-token': os.environ['GH_HYDRATION_TOKEN'],
        'Content-Type': 'application/json'
    }
    payload = {'city_id': city_id, 'status': status}
    if error_msg:
        payload['error_message'] = error_msg
    if stats:
        payload['stats'] = stats
    
    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=30)
        resp.raise_for_status()
    except Exception as e:
        print(f"⚠️ Callback failed: {e}", file=sys.stderr)


def get_bbox_tiles(bbox, grid_size=4):
    """Subdivide a bounding box into a grid of tiles for chunk processing.
    
    Args:
        bbox: [xmin, ymin, xmax, ymax] - City bounding box
        grid_size: Number of divisions per axis (default 4x4 = 16 tiles)
    
    Returns:
        List of (tile_num, tile_bbox) tuples
        
    Example:
        bbox = [-46.826, -23.740, -46.365, -23.357]  # São Paulo
        tiles = get_bbox_tiles(bbox, 4)
        # Returns 16 tiles numbered 1-16
    """
    xmin, ymin, xmax, ymax = bbox
    
    # Calculate step size for each dimension
    x_step = (xmax - xmin) / grid_size
    y_step = (ymax - ymin) / grid_size
    
    tiles = []
    tile_num = 1
    
    for i in range(grid_size):
        for j in range(grid_size):
            # Calculate tile boundaries
            tile_xmin = xmin + (j * x_step)
            tile_xmax = xmin + ((j + 1) * x_step)
            tile_ymin = ymin + (i * y_step)
            tile_ymax = ymin + ((i + 1) * y_step)
            
            tiles.append((tile_num, [tile_xmin, tile_ymin, tile_xmax, tile_ymax]))
            tile_num += 1
    
    return tiles


def discover_city_from_overture(lat: float, lng: float):
    """
    Discover city from Overture Maps theme=divisions dataset.
    Uses JOIN between division_area (geometries) and division (metadata).
    Filters by subtype='locality' for city-level boundaries.
    """
    print(f"🔍 Discovering city from Overture Divisions for point: ({lat}, {lng})")
    print("✅ Using Overture Divisions theme for city discovery")
    
    con = duckdb.connect()
    con.execute("INSTALL spatial; LOAD spatial;")
    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute("SET s3_region='us-west-2';")
    
    # Use divisions theme (replaces deprecated admins)
    # Note: If 2025-12-17.0 gives "No files found", fallback to 2024-11-13.0
    release = '2025-12-17.0'
    area_path = f's3://overturemaps-us-west-2/release/{release}/theme=divisions/type=division_area/*'
    division_path = f's3://overturemaps-us-west-2/release/{release}/theme=divisions/type=division/*'
    
    print(f"📂 Querying division_area: {area_path}")
    print(f"📂 Querying division: {division_path}")
    
    query = f"""
    SELECT 
      area.id AS area_id,
      area.division_id,
      JSON_EXTRACT_STRING(div.names, '$.primary') AS city_name,
      div.country AS country_code,
      div.region AS state,
      area.bbox.xmin, area.bbox.xmax, area.bbox.ymin, area.bbox.ymax,
      ST_AsWKB(area.geometry) AS geom_wkb,
      div.subtype
    FROM read_parquet('{area_path}', filename=true, hive_partitioning=1) AS area
    JOIN read_parquet('{division_path}', filename=true, hive_partitioning=1) AS div
      ON area.division_id = div.id
    WHERE div.subtype = 'locality'
      AND ST_Within(ST_Point({lng}, {lat}), area.geometry)
    LIMIT 1
    """
    
    result = con.execute(query).fetchone()
    con.close()
    
    if not result:
        raise Exception(f"No locality division found for coordinates ({lat}, {lng})")
    
    print(f"✅ Found city: {result[2]} (subtype={result[10]})")
    
    return {
        'division_id': result[1],
        'city_name': result[2],
        'bbox': [result[5], result[7], result[6], result[8]],  # [xmin, ymin, xmax, ymax]
        'geom_wkb': result[9],
        'country_code': result[3],
        'state': result[4]
    }


def insert_city_to_registry(city_data: dict, pg_conn):
    """
    Insert discovered city into cities_registry.
    Returns city UUID.
    """
    print(f"💾 Inserting city '{city_data['city_name']}' into registry")
    
    pg_cur = pg_conn.cursor()
    
    insert_sql = """
    INSERT INTO cities_registry (city_name, country_code, geom, bbox, status)
    VALUES (%s, %s, ST_Multi(ST_GeomFromWKB(%s, 4326)), %s, 'processing')
    RETURNING id
    """
    
    pg_cur.execute(insert_sql, (
        city_data['city_name'],
        city_data['country_code'],
        city_data['geom_wkb'],
        city_data['bbox']  # [xmin, ymin, xmax, ymax]
    ))
    
    city_id = pg_cur.fetchone()[0]
    pg_conn.commit()
    pg_cur.close()
    
    print(f"✅ City inserted with ID: {city_id}")
    return city_id


def fetch_city_from_registry(city_id: str, pg_conn):
    """
    Fetch existing city data from cities_registry.
    """
    print(f"🔍 Fetching city {city_id} from registry")
    
    pg_cur = pg_conn.cursor()
    
    query = """
    SELECT 
      city_name,
      country_code,
      ST_XMin(geom) as xmin,
      ST_YMin(geom) as ymin,
      ST_XMax(geom) as xmax,
      ST_YMax(geom) as ymax
    FROM cities_registry
    WHERE id = %s
    """
    
    pg_cur.execute(query, (city_id,))
    result = pg_cur.fetchone()
    pg_cur.close()
    
    if not result:
        raise Exception(f"City {city_id} not found in registry")
    
    return {
        'city_name': result[0],
        'country_code': result[1],
        'bbox': [result[2], result[3], result[4], result[5]]
    }


def main():
    """Main entry point for hydration script.
    
    Supports two modes:
    1. Direct mode: python hydrate_overture_city.py [city_id] [lat] [lng] [is_update]
    2. Worker mode: python hydrate_overture_city.py --worker
    """
    # Check for worker mode flag
    if len(sys.argv) > 1 and sys.argv[1] == '--worker':
        # Worker queue mode - process multiple cities
        from hydration.queue import worker_main_loop
        print("🔧 Starting in WORKER MODE - processing queue")
        worker_main_loop(max_runtime_seconds=1500)  # 25 minutes
        return
    
    # Direct mode - process single city
    print("🔧 Starting in DIRECT MODE - single city processing")
    
    # Parse CLI args: city_id, lat, lng, is_update
    city_id_arg = sys.argv[1] if len(sys.argv) > 1 else None
    lat = float(sys.argv[2]) if len(sys.argv) > 2 else None
    lng = float(sys.argv[3]) if len(sys.argv) > 3 else None
    is_update = sys.argv[4].lower() == 'true' if len(sys.argv) > 4 else False
    
    # Validate inputs
    if city_id_arg == 'null' or city_id_arg == '':
        city_id_arg = None

    
    if not lat or not lng:
        raise Exception("Latitude and longitude are required")
    
    # Initialize city_id for error handler
    city_id = city_id_arg
    
    try:
        config = load_curation_config()
        
        # PostgreSQL connection
        pg_conn = psycopg2.connect(os.environ['DB_POOLER_URL'])
        
        # Determine mode: discovery or update
        if city_id_arg:
            # Update mode: city already exists in registry
            print(f"\n🔄 UPDATE MODE: Refreshing city {city_id_arg}")
            city_id = city_id_arg
            city_data = fetch_city_from_registry(city_id, pg_conn)
        else:
            # Discovery mode: find city from coordinates
            print(f"\n🆕 DISCOVERY MODE: Finding city at ({lat}, {lng})")
            city_data = discover_city_from_overture(lat, lng)
            city_id = insert_city_to_registry(city_data, pg_conn)
        
        city_name = city_data['city_name']
        bbox = city_data['bbox']
        
        print(f"\n📍 Processing: {city_name}")
        print(f"📦 BBox: {bbox}")
        
        # Load POIs from Overture Maps via DuckDB
        category_map = config['categories']['mapping']
        category_blacklist = config['categories']['blacklist']
        
        # Metrics tracking
        metrics = {
            'total_found': 0,
            'rejected_category': 0,
            'rejected_taxonomy': 0,
            'rejected_osm_tags': 0,
            'rejected_name': 0,
            'rejected_validation': 0,
            'rejected_confidence': 0,
            'final_sent_to_staging': 0
        }
        
        # DuckDB: Query Overture Maps with dynamic category filter
        con = duckdb.connect(':memory:')
        con.execute("INSTALL spatial; LOAD spatial;")
        con.execute("INSTALL httpfs; LOAD httpfs;")
        
        # Generate SQL blacklist dynamically
        blacklist_sql = ', '.join([f"'{cat}'" for cat in category_blacklist])
        
        query = f"""
        SELECT 
          id AS overture_id,
          JSON_EXTRACT_STRING(names, 'primary') AS name,
          categories.primary AS overture_category,
          categories.alternate AS alternate_categories,
          ST_AsWKB(geometry) AS geom_wkb,
          addresses[1].freeform AS street,
          addresses[1].country AS country_code,
          addresses[1].postcode AS postal_code,
          addresses[1].locality AS neighborhood,
          addresses[1].region AS state,
          confidence,
          sources[1] AS source_raw,
          websites,
          socials,
          len(sources) AS source_magnitude,
          (brand IS NOT NULL) AS has_brand
        FROM read_parquet('s3://overturemaps-us-west-2/release/2025-12-17.0/theme=places/type=place/*', filename=true, hive_partitioning=1)
        WHERE 
          bbox.xmin >= {bbox[0]} AND bbox.xmax <= {bbox[2]}
          AND bbox.ymin >= {bbox[1]} AND bbox.ymax <= {bbox[3]}
          AND confidence >= 0.6
          AND categories.primary IS NOT NULL
          AND (operating_status IS NULL OR operating_status = 'open')
          AND NOT list_has_any(
            list_append(categories.alternate, categories.primary),
            [{blacklist_sql}]
          )
        LIMIT 400000
        """
        
        result = con.execute(query).fetchall()
        metrics['total_found'] = len(result)
        con.close()
        
        print(f"📊 DuckDB query found {metrics['total_found']} POIs in BBox")
        
        # PostgreSQL: Connect via Pooler (port 6543)
        pg_conn = psycopg2.connect(os.environ['DB_POOLER_URL'])
        pg_cur = pg_conn.cursor()
        
        # Try to get cached hotlist first (30-day cache)
        hotlist = get_cached_hotlist(city_id, pg_conn)
        if not hotlist:
            # Generate AI hotlist if not cached
            hotlist = generate_hotlist(city_name)
            if hotlist:
                save_hotlist_to_cache(city_id, hotlist, pg_conn)
        
        iconic_matches = []
        
        # STAGE 0: Collect all POIs by category for AI matching
        print("📦 Collecting POIs for AI matching...")
        all_pois_by_category = {}
        poi_data = {}  # poi_id -> (name, row_data) for later processing
        
        for row in result:
            overture_cat = row[2]
            internal_cat = category_map.get(overture_cat)
            if not internal_cat:
                continue
            
            # Sanitize name early
            raw_name = row[1]
            sanitized_name = sanitize_name(raw_name, config)
            if not sanitized_name:
                continue
            
            # Generate temporary ID for POI (use row hash or index)
            poi_id = hash((sanitized_name, row[0]))  # hash of (name, overture_id)
            
            # Extract neighborhood for context
            neighborhood = row[8] if row[8] else None  # neighborhood (locality)
            
            # Store for AI matching - now includes neighborhood
            if internal_cat not in all_pois_by_category:
                all_pois_by_category[internal_cat] = []
            all_pois_by_category[internal_cat].append((sanitized_name, poi_id, neighborhood))
            
            # Store row data for later
            poi_data[poi_id] = (sanitized_name, row)
        
        # Run AI matcher once on all POIs
        matched_iconic_pois = ai_match_iconic_venues(hotlist, all_pois_by_category)
        

        # Process and sanitize
        staging_rows = []
        for row in result:
            overture_cat = row[2]
            alternate_cats = row[3] if row[3] else []
            internal_cat = category_map.get(overture_cat)
            if not internal_cat:
                continue
            
            # Taxonomy hierarchy validation
            if not check_taxonomy_hierarchy(row[9], overture_cat, alternate_cats, config):
                metrics['rejected_taxonomy'] += 1
                continue
            
            # OSM Red Flags
            if not filter_osm_red_flags(row[9], config):
                metrics['rejected_osm_tags'] += 1
                continue
            
            # Name sanitization
            sanitized_name = sanitize_name(row[1], config)
            if not sanitized_name:
                metrics['rejected_name'] += 1
                continue
            
            # Cross validation
            if not validate_category_name(sanitized_name, internal_cat, overture_cat, config):
                metrics['rejected_validation'] += 1
                continue
            
            # Extract new fields for scoring
            source_count = row[14] if row[14] else 1  # source_count
            brand_name = row[15]  # brand_name
            
            
            # Generate POI ID for matching
            poi_id = hash((sanitized_name, row[0]))
            
            # Check if this POI was matched as iconic by AI
            is_iconic = False
            matched_name = None
            if poi_id in matched_iconic_pois:
                is_iconic = True
                matched_name = matched_iconic_pois[poi_id]
                iconic_matches.append({
                    "name": sanitized_name,
                    "matched": matched_name,
                    "category": internal_cat
                })
            # Social scoring + Address completeness + Authority signals
            score_result = calculate_scores(
                row[10],  # confidence
                row[12],  # websites
                row[13],  # socials
                street=row[5],  # street
                house_number=None,  # Parsed later
                neighborhood=row[8],  # neighborhood
                source_magnitude=source_count,
                has_brand=bool(brand_name),
                is_iconic=is_iconic,
                config=config
            )
            if not score_result:
                metrics['rejected_confidence'] += 1
                continue
            
            relevance_score, bonus_flags = score_result
            
            # Add taxonomy weight bonus (from config/curation/taxonomy_rules.json)
            taxonomy_bonus = calculate_taxonomy_weight(internal_cat, overture_cat, config)
            relevance_score += taxonomy_bonus
            if taxonomy_bonus > 0:
                metrics['taxonomy_bonus_count'] = metrics.get('taxonomy_bonus_count', 0) + 1
            
            # Apply taxonomic modifiers (penalties and boosts)
            relevance_score, modifier = apply_scoring_modifiers(relevance_score, internal_cat, overture_cat, config)
            if modifier < 1.0:
                metrics['penalty_count'] = metrics.get('penalty_count', 0) + 1
            elif modifier > 1.0:
                metrics['boost_count'] = metrics.get('boost_count', 0) + 1
            
            
            # CAP removed to allow iconic venues (+100 boost) to rank at top
            # Distance and engagement will still break ties at same relevance level

            
            # Track bonuses for diagnostics
            metrics['total_source_count'] = metrics.get('total_source_count', 0) + source_count
            if bonus_flags['brand_bonus']:
                metrics['brand_bonus_count'] = metrics.get('brand_bonus_count', 0) + 1
            if bonus_flags['dual_presence_bonus']:
                metrics['dual_presence_count'] = metrics.get('dual_presence_count', 0) + 1
            if bonus_flags['magnitude_bonus'] > 0:
                metrics['magnitude_bonus_count'] = metrics.get('magnitude_bonus_count', 0) + 1
            if bonus_flags.get('iconic_bonus', False):
                metrics['iconic_bonus_count'] = metrics.get('iconic_bonus_count', 0) + 1
            
            geom_wkb_hex = row[4].hex()
            
            # Parse house number from street (format: "Street Name, 123")
            street_full = row[5] or ''
            house_number = None
            street_clean = street_full
            
            if street_full and ',' in street_full:
                parts = street_full.rsplit(',', 1)
                if len(parts) == 2 and parts[1].strip().replace('-', '').replace('/', '').isdigit():
                    street_clean = parts[0].strip()
                    house_number = parts[1].strip()
            
            staging_rows.append((
                sanitized_name,
                internal_cat,
                geom_wkb_hex,
                street_clean,  # street without number
                house_number,  # extracted house number
                row[8],  # neighborhood (locality)
                city_name,
                row[9],  # state (region)
                row[7],  # postal_code
                row[6],  # country_code
                relevance_score,  # Use relevance_score instead of structural_score
                row[10],  # confidence
                overture_cat,
                row[0],  # overture_id
                json.dumps(row[11]) if row[11] else None  # overture_raw
            ))
            metrics['final_sent_to_staging'] += 1
        
        # ===========================================
        # DEDUPLICATION: Fuzzy matching for large venues
        # ===========================================
        large_venue_categories = {'park', 'university', 'stadium'}
        
        def deduplicate_staging_pois(rows):
            """
            Deduplicate POIs using grid-based clustering + fuzzy name matching.
            For large venues (park, university, stadium): use 1.1km grid.
            For others: no dedup (each is unique).
            """
            from difflib import SequenceMatcher
            
            # Convert rows to dicts for easier manipulation
            poi_dicts = []
            for row in rows:
                poi_dicts.append({
                    'name': row[0],
                    'category': row[1],
                    'geom_wkb_hex': row[2],
                    'street': row[3],
                    'house_number': row[4],
                    'neighborhood': row[5],
                    'city': row[6],
                    'state': row[7],
                    'postal_code': row[8],
                    'country_code': row[9],
                    'relevance_score': row[10],  # Use relevance_score
                    'confidence': row[11],
                    'original_category': row[12],
                    'overture_id': row[13],
                    'overture_raw': row[14]
                })
            
            # Separate large venues from others
            large_venues = [p for p in poi_dicts if p['category'] in large_venue_categories]
            others = [p for p in poi_dicts if p['category'] not in large_venue_categories]
            
            if not large_venues:
                return rows  # No dedup needed
            
            # Fuzzy clustering: group POIs with similar names together
            # Use Union-Find / connected components approach
            clusters = []
            used = set()
            
            for i, poi in enumerate(large_venues):
                if i in used:
                    continue
                
                # Start new cluster with this POI
                cluster = [poi]
                used.add(i)
                base_name = poi['name'].lower().strip()
                
                # Find all other POIs with EXACT same name
                for j, other_poi in enumerate(large_venues):
                    if j in used:
                        continue
                    
                    other_name = other_poi['name'].lower().strip()
                    
                    # EXACT match only (100% similarity)
                    if base_name == other_name:
                        cluster.append(other_poi)
                        used.add(j)
                
                clusters.append(cluster)
            
            # For each cluster, keep only the best POI
            deduped_large_venues = []
            for cluster in clusters:
                if len(cluster) == 1:
                    deduped_large_venues.append(cluster[0])
                else:
                    # Keep highest relevance_score (if tie, just pick first)
                    cluster.sort(key=lambda x: x['relevance_score'], reverse=True)
                    best = cluster[0]
                    deduped_large_venues.append(best)
            
            # Combine deduped large venues with untouched others
            all_deduped = deduped_large_venues + others
            
            # Convert back to tuples
            deduped_rows = []
            for poi in all_deduped:
                deduped_rows.append((
                    poi['name'],
                    poi['category'],
                    poi['geom_wkb_hex'],
                    poi['street'],
                    poi['house_number'],
                    poi['neighborhood'],
                    poi['city'],
                    poi['state'],
                    poi['postal_code'],
                    poi['country_code'],
                    poi['relevance_score'],  # Use relevance_score
                    poi['confidence'],
                    poi['original_category'],
                    poi['overture_id'],
                    poi['overture_raw']
                ))
            
            return deduped_rows
        
        # Apply deduplication
        original_count = len(staging_rows)
        staging_rows = deduplicate_staging_pois(staging_rows)
        deduped_count = len(staging_rows)
        
        print(f"✅ Sanitization: {metrics['final_sent_to_staging']} POIs passed filters")
        
        # Diagnostic logs for data magnitude
        total_pois = metrics['final_sent_to_staging']
        avg_sources = metrics.get('total_source_count', 0) / total_pois if total_pois > 0 else 0
        brand_count = metrics.get('brand_bonus_count', 0)
        dual_count = metrics.get('dual_presence_count', 0)
        magnitude_count = metrics.get('magnitude_bonus_count', 0)
        taxonomy_count = metrics.get('taxonomy_bonus_count', 0)
        penalty_count = metrics.get('penalty_count', 0)
        boost_count = metrics.get('boost_count', 0)
        
        print(f"📊 Relevance Bonuses Applied:")
        print(f"   📚 Avg Sources: {avg_sources:.2f} | Multi-Source: {magnitude_count} POIs (+10/+30)")
        print(f"   🏷️  Brand Authority: {brand_count} POIs (+20)")
        print(f"   🌐 Dual Presence (web+social): {dual_count} POIs (+20)")
        print(f"   🏷️  Taxonomy Weight: {taxonomy_count} POIs (configurable)")
        print(f"📊 Taxonomic Modifiers:")
        
        # Log iconic matches
        if iconic_matches:
            print(f"\n✨ Iconic Matches Found: {len(iconic_matches)} venues")
            for match in iconic_matches[:10]:  # Show first 10
                name, matched, sim, cat = match.get("name", ""), match.get("matched", ""), match.get("similarity", 0.0), match.get("category", "")
            if len(iconic_matches) > 10:
                print(f"   ... and {len(iconic_matches) - 10} more")
        print(f"   ⬇️  Penalties Applied: {penalty_count} POIs (fast-food, gas stations)")
        print(f"   ⬆️  Boosts Applied: {boost_count} POIs (bars, stadiums, parks)")
        
        if original_count != deduped_count:
            print(f"🔍 Deduplication: {original_count} → {deduped_count} POIs ({original_count - deduped_count} duplicates removed)")
        print(f"💾 Final count for staging: {deduped_count} POIs")
        
        # Bulk insert to staging
        insert_sql = """
        INSERT INTO staging_places (
          name, category, geom_wkb_hex, street, house_number,
          neighborhood, city, state, postal_code, country_code,
          relevance_score, confidence, original_category,
          overture_id, overture_raw
        ) VALUES %s
        """
        
        execute_values(pg_cur, insert_sql, staging_rows, page_size=500)
        pg_conn.commit()
        
        print(f"💾 Bulk inserted {len(staging_rows)} rows to staging")
        
        # Execute merge
        merge_sql = "SELECT * FROM merge_staging_to_production(%s)"
        pg_cur.execute(merge_sql, (city_id if is_update else None,))
        merge_result = pg_cur.fetchone()
        pg_conn.commit()  # Commit merge transaction
        
        pg_cur.close()
        pg_conn.close()
        
        # Report
        print("=" * 60)
        print("SANITIZATION METRICS")
        print("=" * 60)
        print(f"Total POIs found in BBox:        {metrics['total_found']}")
        print(f"Rejected - Category Blacklist:   (filtered in DuckDB)")
        print(f"Rejected - Taxonomy Hierarchy:   {metrics['rejected_taxonomy']}")
        print(f"Rejected - OSM Red Flags:        {metrics['rejected_osm_tags']}")
        print(f"Rejected - Name Blacklist:       {metrics['rejected_name']}")
        print(f"Rejected - Cross Validation:     {metrics['rejected_validation']}")
        print(f"Rejected - Low Confidence:       {metrics['rejected_confidence']}")
        print(f"✅ Final sent to staging:        {metrics['final_sent_to_staging']}")
        print("=" * 60)
        
        stats = {
            'places_inserted': merge_result[0],
            'places_updated': merge_result[1],
            'places_deactivated': merge_result[2],
            'sources_inserted': merge_result[3],
            'sanitization_metrics': metrics
        }
        
        print(f"✅ Merge complete: {stats}")
        finalize_callback(city_id, 'completed', stats=stats)
        
    except Exception as e:
        error_msg = f"Critical failure: {str(e)}"
        print(f"❌ {error_msg}", file=sys.stderr)
        finalize_callback(city_id, 'failed', error_msg=error_msg)
        sys.exit(1)


if __name__ == '__main__':
    main()
