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


def sanitize_name(name, config):
    """Remove company suffixes and validate against blacklist."""
    if not name:
        return None
    
    name_lower = name.lower()
    for term in config['names']['blacklist']:
        if term in name_lower:
            return None
    
    cleaned = name
    for suffix in config['names']['suffixes_to_remove']:
        if cleaned.endswith(suffix):
            cleaned = cleaned[:-len(suffix)].strip()
    
    return cleaned


def validate_category_name(name, category, original_category, config):
    """Validate consistency between category and name."""
    name_lower = name.lower()
    
    rules = config['taxonomy']['cross_validation_rules']
    
    # Check required_terms rules
    if category in rules and 'required_terms' in rules[category]:
        required_terms = rules[category]['required_terms']
        if not any(term in name_lower for term in required_terms):
            return False
    
    # Check forbidden_terms rules
    if category in rules and 'forbidden_terms' in rules[category]:
        forbidden_terms = rules[category]['forbidden_terms']
        if any(term in name_lower for term in forbidden_terms):
            return False
    
    return True


def calculate_scores(confidence, websites, socials):
    """Calculate scores based on social signals."""
    has_social = False
    if socials:
        for social in socials:
            if isinstance(social, dict):
                platform = social.get('platform', '').lower()
                if platform in ['instagram', 'facebook']:
                    has_social = True
                    break
    
    has_website = bool(websites and len(websites) > 0)
    has_online = has_website or has_social
    
    if not has_online and confidence < 0.9:
        return None
    
    base_score = 5
    relevance = 0
    
    if has_website:
        base_score += 10
        relevance += 10
    
    if has_social:
        base_score += 15
        relevance += 20
    
    if confidence >= 0.9:
        base_score += 5
        relevance += 5
    
    return (base_score, relevance)


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


def main():
    city_id = sys.argv[1]
    city_name = sys.argv[2]
    bbox_json = sys.argv[3]
    country_code = sys.argv[4]
    is_update = sys.argv[5].lower() == 'true'
    
    try:
        bbox = json.loads(bbox_json)
        
        # Load curation configurations
        config = load_curation_config()
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
          socials
        FROM read_parquet('s3://overturemaps-us-west-2/release/*/theme=places/**/*.parquet')
        WHERE 
          bbox.xmin >= {bbox[0]} AND bbox.xmax <= {bbox[2]}
          AND bbox.ymin >= {bbox[1]} AND bbox.ymax <= {bbox[3]}
          AND confidence >= 0.6
          AND categories.primary IS NOT NULL
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
            
            # Social scoring
            score_result = calculate_scores(row[8], row[10], row[11])
            if not score_result:
                metrics['rejected_confidence'] += 1
                continue
            
            structural_score, relevance_score = score_result
            
            # Add taxonomy bonus
            taxonomy_bonus = calculate_taxonomy_weight(internal_cat, overture_cat, config)
            relevance_score += taxonomy_bonus
            
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
                structural_score,
                row[10],  # confidence
                overture_cat,
                row[0],  # overture_id
                json.dumps(row[11]) if row[11] else None  # overture_raw
            ))
            metrics['final_sent_to_staging'] += 1
        
        print(f"✅ {metrics['final_sent_to_staging']} POIs passed sanitization")
        
        # Bulk insert to staging
        insert_sql = """
        INSERT INTO staging_places (
          name, category, geom_wkb_hex, street, house_number,
          neighborhood, city, state, postal_code, country_code,
          structural_score, confidence, original_category,
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
