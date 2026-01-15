"""
Database operations for city hydration.
Includes city discovery, registry management, and merge operations.
"""
import psycopg2


def insert_city_to_registry(city_data: dict, pg_conn):
    """Insert discovered city into cities_registry.
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
