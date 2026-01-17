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
import time  # For sleep between batches
from psycopg2.extras import execute_values
import requests

# Import from hydration modules
from hydration.utils import load_config, build_category_map, sanitize_name, parse_street_address
from hydration.deduplication import deduplicate_pois_in_memory, POIColumn
from hydration.validation import validate_category_name, check_taxonomy_hierarchy, filter_osm_red_flags
from hydration.scoring import calculate_scores, apply_scoring_modifiers, calculate_taxonomy_weight
from hydration.ai_matcher import (
    generate_hotlist,
    get_cached_hotlist,
    save_hotlist_to_cache,
    ai_match_iconic_venues
)
from hydration.database import upsert_city_to_registry, fetch_city_from_registry


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


def filter_osm_source_tags(source_raw, config):
    """
    Check OSM source tags for red flags (different from alternate categories check).
    Returns TRUE to REJECT, FALSE to ACCEPT.
    """
    if not source_raw or not isinstance(source_raw, dict):
        return False  # No source = accept (innocent until proven guilty)
    
    tags = source_raw.get('tags', {})
    if not tags:
        return False  # No tags = accept
    
    osm_flags = config['taxonomy']['osm_red_flags']
    
    for key, forbidden_values in osm_flags.items():
        tag_value = tags.get(key, '').lower()
        if not tag_value:
            continue
        
        # Special case: allow therapeutic massage, reject erotic
        if key == 'healthcare' and tag_value == 'massage':
            massage_type = tags.get('massage', '').lower()
            if massage_type in ['spa', 'sports', 'medical', 'physiotherapy']:
                continue
        
        for forbidden in forbidden_values:
            if forbidden in tag_value:
                return True  # REJECT - has red flag
    
    return False  # ACCEPT - no red flags found


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




def build_category_filter(config):
    """Build SQL IN clause from category mapping keys.
    
    This implements predicate pushdown - filtering at the DuckDB/S3 level
    instead of pulling all data and filtering in Python.
    
    Returns:
        str: Comma-separated quoted category list for SQL IN clause
    """
    categories = list(config['categories']['mapping'].keys())
    return ', '.join([f"'{cat}'" for cat in categories])


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


def upsert_city_to_registry(city_data: dict, pg_conn):
    """
    Upsert discovered city into cities_registry.
    If city exists (e.g., status='failed'), update it and reset to 'processing'.
    Returns city UUID.
    """
    print(f"💾 Upserting city '{city_data['city_name']}' into registry")
    
    pg_cur = pg_conn.cursor()
    
    # ========================================================================
    # ATOMIC IDENTITY LOCK: Prevent race condition for city discovery
    # ========================================================================
    # Only first worker to INSERT city gets the lock and continues hydration
    # Other workers see None (ON CONFLICT DO NOTHING) and exit gracefully
    upsert_sql = """
    INSERT INTO cities_registry (city_name, country_code, geom, bbox, status, lat, lng)
    VALUES (%s, %s, ST_Multi(ST_GeomFromWKB(%s, 4326)), %s, 'processing', %s, %s)
    ON CONFLICT (city_name, country_code) DO NOTHING
    RETURNING id
    """
    
    pg_cur.execute(upsert_sql, (
        city_data['city_name'],
        city_data['country_code'],
        city_data['geom_wkb'],
        city_data['bbox'],
        city_data.get('lat'),
        city_data.get('lng')
    ))
    
    result = pg_cur.fetchone()
    
    # If result is None, another worker already created this city
    if result is None:
        print("⚠️  Célula de processamento duplicada detectada.")
        print("⚠️  Outro worker já está processando esta cidade.")
        print("✅ Encerrando worker para economizar recursos.")
        pg_conn.commit()
        pg_conn.close()
        sys.exit(0)  # Graceful exit
    
    city_id = result[0]
    pg_conn.commit()
    pg_cur.close()
    
    print(f"✅ City upserted with ID: {city_id}")
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
    pg_conn = None
    
    try:
        config = load_curation_config()
        
        # Process in batches (10000k records per commit - balanced for performance/safety)
        BATCH_SIZE = 10000
        pg_conn = psycopg2.connect(os.environ['DB_POOLER_URL'])
        pg_cur = pg_conn.cursor()
        
        # ATOMIC LOCK: Try to acquire exclusive lock on city
        print(f"🔍 Looking for city at ({lat}, {lng})...")
        check_sql = """
        SELECT id, city_name, country_code, bbox, status
        FROM cities_registry
        WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint(%s, %s), 4326))
        FOR UPDATE SKIP LOCKED
        LIMIT 1
        """
        
        pg_cur.execute(check_sql, (lng, lat))
        existing_city = pg_cur.fetchone()
        
        if existing_city:
            # Got the lock - update status and process
            city_id = existing_city[0]
            city_name = existing_city[1]
            current_status = existing_city[4]
            
            print(f"✅ Locked city: {city_name} ({city_id}, status={current_status})")
            
            # Skip if already completed (unless is_update=true)
            if current_status == 'completed' and not is_update:
                print(f"⏭️  City already completed, skipping (use is_update=true to force re-hydration)")
                pg_conn.close()
                sys.exit(0)
            
            # Update to processing (NO COMMIT - keep lock!)
            pg_cur.execute(
                "UPDATE cities_registry SET status = 'processing', updated_at = NOW() WHERE id = %s",
                (city_id,)
            )
            # CRITICAL: Do NOT commit here - lock must persist until processing completes
            print("✅ Status updated to 'processing' (lock held)")
            
            city_data = {
                'city_name': existing_city[1],
                'country_code': existing_city[2],
                'bbox': existing_city[3]
            }
        else:
            # Couldn't lock - either doesn't exist OR already locked by another worker
            # Try to discover (if doesn't exist, will insert)
            print("⚠️  Could not lock city (doesn't exist or locked by another worker)")
            city_data = discover_city_from_overture(lat, lng)
            
            # Try to insert/upsert
            city_id = upsert_city_to_registry(city_data, pg_conn)
            
            if not city_id:
                # Another worker is processing this city
                print("❌ City is being processed by another worker, aborting")
                pg_conn.close()
                sys.exit(0)  # Exit gracefully
            
            city_name = city_data['city_name']
        
        bbox = city_data['bbox']
        pg_cur = pg_conn.cursor()
        
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
          AND confidence >= 0.5
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
            hotlist = generate_hotlist(
                city_name,
                state=city_data.get('state'),
                country_code=city_data.get('country_code')
            )
            if hotlist:
                save_hotlist_to_cache(city_id, hotlist, pg_conn)
        
        # ====================================================================
        # PREDICATE PUSHDOWN: Filter categories at DuckDB level
        # ====================================================================
        
        # DuckDB: Query Overture with category filter
        con = duckdb.connect(':memory:')
        con.execute("INSTALL spatial; LOAD spatial;")
        con.execute("INSTALL httpfs; LOAD httpfs;")
        
        category_map = config['categories']['mapping']
        category_filter = build_category_filter(config)
        
        print(f"\n� Querying Overture with predicate pushdown...")
        print(f"   Only fetching social POIs (bars, restaurants, parks, etc.)")
        
        query = f"""
        SELECT 
          id AS overture_id,
          JSON_EXTRACT_STRING(names, 'primary') AS name,
          categories.primary AS overture_category,
          categories.alternate AS alternate_categories,
          ST_AsWKB(geometry) AS geom_wkb,
          addresses[1].freeform AS street,
          NULL AS house_number,  -- number field doesn't exist in Overture schema
          addresses[1].locality AS neighborhood,
          addresses[1].postcode AS postal_code,
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
          AND categories.primary IN ({category_filter})
          AND confidence >= 0.5
          AND (operating_status IS NULL OR operating_status = 'open')
        LIMIT 500000
        """
        
        all_pois = con.execute(query).fetchall()
        con.close()
        
        
        total_pois = len(all_pois)
        print(f"✅ Loaded {total_pois:,} social POIs (filtered at source)")
        
        # Parse addresses to extract street and house_number from freeform
        print(f"🏠 Parsing addresses to extract house numbers...")
        parsed_pois = []
        for row in all_pois:
            # Parse freeform address (index 5 = street)
            freeform = row[POIColumn.STREET]
            street, house_number = parse_street_address(freeform)
            
            # Replace freeform with parsed street and add house_number
            parsed_row = list(row)
            parsed_row[POIColumn.STREET] = street
            parsed_row[POIColumn.HOUSE_NUMBER] = house_number
            parsed_pois.append(tuple(parsed_row))
        
        all_pois = parsed_pois
        print(f"✅ Parsed {len(all_pois):,} addresses")
        
        if total_pois == 0:
            print("⚠️  No POIs found in this city!")
            finalize_callback(city_id, 'completed', stats={'inserted': 0, 'updated': 0})
            return
        
        
        # ====================================================================
        # SIMPLE DEDUP: Remove exact duplicates (same name + street + house_number)
        # ====================================================================
        print(f"\n🧹 Removing exact duplicates from {total_pois:,} POIs...")
        from hydration.deduplication import deduplicate_pois_in_memory
        
        # Non-destructive architecture: preserve ALL POI data
        deduplicated_pois, duplicate_mappings, all_pois_data = deduplicate_pois_in_memory(all_pois, config)
        total_unique = len(deduplicated_pois)
        total_duplicates = len(duplicate_mappings)
        
        print(f"✅ Deduplication complete: {total_unique:,} unique POIs ({total_duplicates:,} exact duplicates removed)")
        
        # ====================================================================
        # BATCH PROCESSING: Process deduplicated POIs in 10000-record batches
        # ====================================================================
        
        BATCH_SIZE = 10000
        num_batches = (total_unique + BATCH_SIZE - 1) // BATCH_SIZE
        
        print(f"\n📦 Processing in {num_batches} batches of {BATCH_SIZE} records")
        print(f"   Strategy: Incremental commits to prevent database locks\n")
        
        total_inserted = 0
        total_updated = 0
        
        for batch_num in range(num_batches):
            start_idx = batch_num * BATCH_SIZE
            end_idx = min(start_idx + BATCH_SIZE, total_unique)
            batch_pois = deduplicated_pois[start_idx:end_idx]
            
            # Detect if this is the final batch
            is_final_batch = (batch_num == num_batches - 1)
            
            print(f"{'='*70}")
            print(f"[BATCH {batch_num+1}/{num_batches}] Processing {len(batch_pois)} POIs... (Final Batch: {is_final_batch})")
            
            # Collect POIs for AI matching
            all_pois_by_category = {}
            poi_data = {}
            
            for row in batch_pois:
                overture_cat = row[POIColumn.OVERTURE_CATEGORY]
                internal_cat = category_map.get(overture_cat)
                if not internal_cat:
                    continue
                
                raw_name = row[POIColumn.NAME]
                sanitized_name = sanitize_name(raw_name, config)
                if not sanitized_name:
                    continue
                
                poi_id = len(poi_data)
                neighborhood = row[POIColumn.NEIGHBORHOOD]  # Fixed: was row[6] (HOUSE_NUMBER)
                
                if internal_cat not in all_pois_by_category:
                    all_pois_by_category[internal_cat] = []
                
                all_pois_by_category[internal_cat].append((sanitized_name, poi_id, neighborhood))
                poi_data[poi_id] = (sanitized_name, row)
            
            # AI matching for this batch (reuse hotlist)
            iconic_matches = ai_match_iconic_venues(hotlist, all_pois_by_category) if hotlist else []
            iconic_ids = set(iconic_matches)
            
            print(f"   🤖 AI matched {len(iconic_ids)} iconic venues in this batch")
            
            # Process POIs in this batch
            staging_rows = []
            
            # Debug counters
            debug_rejected = {
                'no_cat': 0,
                'validate_name': 0,
                'taxonomy': 0,
                'osm_flags': 0,
                'score': 0
            }
            
            for poi_id, (name, row) in poi_data.items():
                overture_cat = row[POIColumn.OVERTURE_CATEGORY]
                internal_cat = category_map.get(overture_cat)
                
                if not internal_cat:
                    debug_rejected['no_cat'] += 1
                    continue
                
                # Validation
                if not validate_category_name(name, internal_cat, overture_cat, config):
                    debug_rejected['validate_name'] += 1
                    continue
                
                if not check_taxonomy_hierarchy(internal_cat, overture_cat, row[POIColumn.ALTERNATE_CATEGORIES], config):
                    debug_rejected['taxonomy'] += 1
                    continue
                
                if filter_osm_source_tags(row[POIColumn.SOURCE_RAW], config):  # Fixed: was row[10] (CONFIDENCE)
                    debug_rejected['osm_flags'] += 1
                    continue
                
                # Scoring
                is_iconic = poi_id in iconic_ids
                source_magnitude = row[POIColumn.SOURCE_MAGNITUDE]  # Fixed: was row[13] (SOCIALS)
                has_brand = row[POIColumn.HAS_BRAND]  # Fixed: was row[14] (SOURCE_MAGNITUDE)
                
                score_result = calculate_scores(
                    float(row[POIColumn.CONFIDENCE]) if row[POIColumn.CONFIDENCE] else 0.0,
                    row[POIColumn.WEBSITES],
                    row[POIColumn.SOCIALS],
                    street=row[POIColumn.STREET],
                    house_number=row[POIColumn.HOUSE_NUMBER],
                    neighborhood=row[POIColumn.NEIGHBORHOOD],
                    source_magnitude=source_magnitude,
                    has_brand=bool(has_brand),
                    is_iconic=is_iconic,
                    config=config
                )
                
                if not score_result:
                    debug_rejected['score'] += 1
                    continue
                
                relevance_score, bonus_flags = score_result
                
                # Taxonomy bonus
                taxonomy_bonus = calculate_taxonomy_weight(internal_cat, overture_cat, config)
                relevance_score += taxonomy_bonus
                
                # Apply modifiers
                relevance_score, modifier = apply_scoring_modifiers(relevance_score, internal_cat, overture_cat, config)
                
                # Prepare for staging
                geom_wkb = row[POIColumn.GEOM_WKB]
                geom_hex = geom_wkb.hex() if geom_wkb else None
                
                staging_rows.append((
                    name,
                    internal_cat,
                    geom_hex,
                    row[POIColumn.STREET],
                    row[POIColumn.HOUSE_NUMBER],
                    row[POIColumn.NEIGHBORHOOD],
                    city_name,
                    row[POIColumn.STATE],
                    row[POIColumn.POSTAL_CODE],
                    city_data.get('country_code'),
                    relevance_score,
                    row[POIColumn.CONFIDENCE],
                    overture_cat,
                    row[POIColumn.OVERTURE_ID],
                    json.dumps(row[POIColumn.SOURCE_RAW]) if row[POIColumn.SOURCE_RAW] else None
                ))
            
            print(f"   ✅ Processed {len(staging_rows)} valid POIs")
            print(f"   🐛 DEBUG Rejections: no_cat={debug_rejected['no_cat']}, validate_name={debug_rejected['validate_name']}, taxonomy={debug_rejected['taxonomy']}, osm_flags={debug_rejected['osm_flags']}, score={debug_rejected['score']}")
            
            # Insert to staging
            if staging_rows:
                insert_sql = """
                INSERT INTO staging_places (
                  name, category, geom_wkb_hex, street, house_number,
                  neighborhood, city, state, postal_code, country_code,
                  relevance_score, confidence, original_category,
                  overture_id, overture_raw
                ) VALUES %s
                """
                
                execute_values(pg_cur, insert_sql, staging_rows, page_size=500)
                print(f"   💾 Inserted to staging")
                
                # Merge to production (pass bbox for timestamp+spatial soft delete)
                merge_sql = "SELECT * FROM merge_staging_to_production(%s, %s, %s)"
                pg_cur.execute(merge_sql, (city_id, bbox, is_final_batch))
                merge_result = pg_cur.fetchone()
                
                if merge_result:
                    inserted, updated, sources_updated, deactivated = merge_result
                    total_inserted += inserted
                    total_updated += updated
                    
                    # Log results
                    print(f"   🔄 Merged: {inserted} inserted, {updated} updated")
                    if is_final_batch and deactivated > 0:
                        print(f"   🗑️  Soft deleted: {deactivated} missing places (final batch cleanup)")
                
                # CRITICAL: Commit transaction (releases locks!)
                pg_conn.commit()
                print(f"   ✅ Transaction committed")
                
                # CRITICAL IDEMPOTENCY FIX: Link duplicate overture_ids to winners
                # This prevents re-processing the same POIs next month
                duplicate_links = []
                for row in batch_pois:
                    overture_id = row[POIColumn.OVERTURE_ID]
                    winner_id = duplicate_mappings.get(overture_id, overture_id)
                    
                    # Only process if this is a "loser" (merged into another)
                    if winner_id != overture_id:
                        # Find the place_id of the winner
                        pg_cur.execute(
                            "SELECT place_id FROM place_sources WHERE provider = 'overture' AND external_id = %s",
                            (winner_id,)
                        )
                        winner_place = pg_cur.fetchone()
                        
                        if winner_place:
                            duplicate_links.append((
                                winner_place[0],  # place_id (winner's)
                                'overture',
                                overture_id,  # external_id (loser's)
                                json.dumps(row[POIColumn.SOURCE_RAW]) if row[POIColumn.SOURCE_RAW] else None  # Fixed: was row[10] (CONFIDENCE)
                            ))
                
                # Batch insert duplicate links
                if duplicate_links:
                    link_sql = """
                    INSERT INTO place_sources (place_id, provider, external_id, raw, created_at)
                    VALUES %s
                    ON CONFLICT (provider, external_id) DO UPDATE SET
                        place_id = EXCLUDED.place_id,
                        raw = EXCLUDED.raw,
                        created_at = NOW()
                    """
                    execute_values(pg_cur, link_sql, 
                                 [(pid, prov, eid, raw, 'NOW()') for pid, prov, eid, raw in duplicate_links])
                    pg_conn.commit()
                    print(f"   🔗 Linked {len(duplicate_links)} duplicate IDs to winners")
                
                # CRITICAL: Truncate staging for next batch
                pg_cur.execute("TRUNCATE staging_places")
                pg_conn.commit()
                print(f"   🧹 Staging truncated")
            
            # CRITICAL: Sleep between batches (database recovery)
            if batch_num < num_batches - 1:
                print(f"   😴 Sleeping 2s for database recovery...")
                time.sleep(2)
        
        # Close connections
        pg_cur.close()
        pg_conn.close()
        
        # Final report
        print(f"\n{'='*70}")
        print(f"🎯 BATCH PROCESSING COMPLETE: {city_name}")
        print(f"{'='*70}")
        print(f"Total POIs found:    {total_pois:,}")
        print(f"Batches processed:   {num_batches}")
        print(f"Total inserted:      {total_inserted:,}")
        print(f"Total updated:       {total_updated:,}")
        print(f"{'='*70}")
        
        stats = {
            'inserted': total_inserted,
            'updated': total_updated,
            'batches_processed': num_batches
        }
        
        finalize_callback(city_id, 'completed', stats=stats)
        
    except Exception as e:
        import traceback
        error_msg = f"Critical failure: {str(e)}"
        print(f"❌ {error_msg}", file=sys.stderr)
        traceback.print_exc()
        finalize_callback(city_id, 'failed', error_msg=error_msg)
        sys.exit(1)
    
    finally:
        # CRITICAL: Always close connection to release locks
        if pg_conn:
            try:
                pg_conn.rollback()  # Rollback any uncommitted transaction
                pg_conn.close()
                print("🔓 Database connection closed")
            except Exception as cleanup_error:
                print(f"⚠️  Error during cleanup: {cleanup_error}", file=sys.stderr)


if __name__ == '__main__':
    main()
