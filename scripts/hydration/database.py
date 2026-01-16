"""
Database operations for city hydration.
Includes city discovery, registry management, and merge operations.
"""
import psycopg2


def upsert_city_to_registry(city_data: dict, pg_conn):
    """
    Try to upsert city into registry with lock protection.
    If city exists and is locked by another worker, returns None.
    Otherwise inserts/updates and returns city UUID.
    """
    print(f"💾 Attempting to upsert city '{city_data['city_name']}'...")
    
    pg_cur = pg_conn.cursor()
    
    try:
        # Step 1: Try to lock existing city
        lock_sql = """
        SELECT id FROM cities_registry
        WHERE city_name = %s AND country_code = %s
        FOR UPDATE SKIP LOCKED
        """
        
        pg_cur.execute(lock_sql, (city_data['city_name'], city_data['country_code']))
        existing = pg_cur.fetchone()
        
        if existing:
            # Already exists and we got the lock - update it
            city_id = existing[0]
            print(f"🔒 Locked existing city {city_id}, updating...")
            
            update_sql = """
            UPDATE cities_registry SET
                geom = ST_Multi(ST_GeomFromWKB(%s, 4326)),
                bbox = %s,
                lat = %s,
                lng = %s,
                status = 'processing',
                error_message = NULL,
                updated_at = NOW()
            WHERE id = %s
            """
            
            pg_cur.execute(update_sql, (
                city_data['geom_wkb'],
                city_data['bbox'],
                city_data.get('lat'),
                city_data.get('lng'),
                city_id
            ))
            pg_conn.commit()
            pg_cur.close()
            print(f"✅ City {city_id} updated")
            return city_id
        
        # City doesn't exist OR is locked - try to insert
        insert_sql = """
        INSERT INTO cities_registry (city_name, country_code, geom, bbox, status, lat, lng)
        VALUES (%s, %s, ST_Multi(ST_GeomFromWKB(%s, 4326)), %s, 'processing', %s, %s)
        ON CONFLICT (city_name, country_code) DO NOTHING
        RETURNING id
        """
        
        pg_cur.execute(insert_sql, (
            city_data['city_name'],
            city_data['country_code'],
            city_data['geom_wkb'],
            city_data['bbox'],
            city_data.get('lat'),
            city_data.get('lng')
        ))
        
        result = pg_cur.fetchone()
        if result:
            city_id = result[0]
            pg_conn.commit()
            pg_cur.close()
            print(f"✅ New city {city_id} inserted")
            return city_id
        else:
            # Another worker inserted it between our lock check and insert
            pg_conn.rollback()
            pg_cur.close()
            print("⚠️  City locked by another worker (race during insert)")
            return None
            
    except Exception as e:
        pg_conn.rollback()
        pg_cur.close()
        raise e


def fetch_city_from_registry(city_id: str, pg_conn):
    """Fetch existing city data from cities_registry."""
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
