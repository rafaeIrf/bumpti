"""
Precision Geofencing Module
==========================
Handles polygon enrichment and boundary generation for POIs.

Area categories (parks, stadiums, universities): Use real polygon boundaries from Overture
Point categories (bars, restaurants): Use 60m precision circles
All boundaries include 60m safety margin for GPS error compensation.
"""

import duckdb
import json
import os
from typing import Dict, List, Tuple, Optional, Any

# GeoPandas and Shapely for spatial operations
try:
    import geopandas as gpd
    from shapely.geometry import Point, mapping
    from shapely import wkb as shapely_wkb
    from shapely.validation import make_valid
    GEOPANDAS_AVAILABLE = True
except ImportError:
    GEOPANDAS_AVAILABLE = False
    print("⚠️ GeoPandas not available - geofencing disabled")

# RapidFuzz for name similarity matching
try:
    from rapidfuzz import fuzz
    RAPIDFUZZ_AVAILABLE = True
except ImportError:
    RAPIDFUZZ_AVAILABLE = False

# =============================================================================
# CATEGORY DEFINITIONS
# =============================================================================

# Categories that should use real polygon boundaries (large area venues)
AREA_CATEGORIES = {
    'park',       # park, botanical_garden, skate_park
    'stadium',    # stadium_arena
    'university', # college_university
    'shopping',   # shopping_mall
    'event_venue',# venue_and_event_space, music_venue, etc.
    'museum',     # museum, art_museum, history_museum
    'club',       # country_club, social_club, sports_club_and_league
    'theatre',    # theatre, cinema - large performance venues
}

# Categories that use point-based boundaries (precision circles)
POINT_CATEGORIES = {
    'bar',
    'nightclub',
    'restaurant',
    'cafe',
    'gym',
    'plaza',
    'library',
    'community_centre',
    'sports_centre',
    'language_school',
    'commercial_center',
    'skate_park'
}


# Fallback radius (in meters) for area categories without polygon matches
# Note: Uses INTERNAL categories (after mapping), not Overture categories
FALLBACK_RADIUS = {
    'park': 400,
    'university': 150,
    'stadium': 150,
    'shopping': 300,
    'event_venue': 100,
    'club': 200,
    'museum': 200,  # Large museums like Museu Oscar Niemeyer
    'theatre': 100,  # Theatres and cinemas - similar to event venues
}

# Safety margin (in meters) for GPS error compensation
SAFETY_MARGIN_METERS = 60

# Land-use class whitelist per category (prevents incorrect polygon associations)
# Note: Uses INTERNAL categories (after mapping), not Overture categories
VALID_LAND_USE_CLASSES = {
    'park': {'park', 'recreation_ground', 'protected_landscape_seascape', 'natural_monument', 'meadow', 'grass', 'playground'},
    'plaza': {'plaza', 'pedestrian'},
    'university': {'university', 'college'},
    'shopping': {'retail', 'commercial'},
    'botanical_garden': {'park', 'recreation_ground'},
    'club': {'recreation_ground', 'sports_centre', 'grass'},
    'museum': {'museum', 'attraction'},
    'stadium': {'stadium', 'sports_centre', 'pitch'},  # Stadiums and sports arenas
    'event_venue': {'entertainment'},
    'theatre': {'entertainment', 'civic'},  # Theatres, cinemas, performance venues
}

# Overture release version for polygon sources
OVERTURE_RELEASE = '2026-01-21.0'


def fetch_city_polygons(bbox: List[float], con=None) -> Optional['gpd.GeoDataFrame']:
    """
    Fetch polygons from Overture land_use and buildings themes for the city.
    
    Args:
        bbox: [min_lng, min_lat, max_lng, max_lat]
        con: Optional existing DuckDB connection
    
    Returns:
        GeoDataFrame with polygon geometries and metadata, or None if unavailable.
    """
    if not GEOPANDAS_AVAILABLE:
        return None
    
    close_conn = False
    if con is None:
        con = duckdb.connect(':memory:')
        con.execute("INSTALL spatial; LOAD spatial;")
        con.execute("INSTALL httpfs; LOAD httpfs;")
        con.execute("SET s3_region='us-west-2';")
        close_conn = True
    
    min_lng, min_lat, max_lng, max_lat = bbox
    
    # Query land_use theme for parks, universities, commercial zones
    land_use_path = f"s3://overturemaps-us-west-2/release/{OVERTURE_RELEASE}/theme=base/type=land_use/*"
    
    query = f"""
    SELECT
        id,
        JSON_EXTRACT_STRING(names, '$.primary') AS poly_name,
        class,
        subtype,
        ST_AsWKB(geometry) AS geom_wkb,
        ST_Area_Spheroid(geometry) AS area_sqm
    FROM read_parquet('{land_use_path}', filename=true, hive_partitioning=1)
    WHERE bbox.xmin >= {min_lng} AND bbox.xmax <= {max_lng}
      AND bbox.ymin >= {min_lat} AND bbox.ymax <= {max_lat}
      AND class IN ('park', 'recreation_ground', 'university', 'college', 'retail', 'commercial', 'plaza', 'pedestrian')
    LIMIT 50000
    """
    
    try:
        results = con.execute(query).fetchall()
    except Exception as e:
        print(f"❌ Failed to query land_use: {e}")
        results = []
    
    # Query buildings theme for large named structures (shopping centers, stadiums, etc.)
    # Uses Parquet pushdown filters to eliminate 90% of residential buildings
    buildings_path = f"s3://overturemaps-us-west-2/release/{OVERTURE_RELEASE}/theme=buildings/type=building/*"
    
    buildings_query = f"""
    SELECT
        id,
        JSON_EXTRACT_STRING(names, '$.primary') AS poly_name,
        'building' AS class,
        subtype,
        ST_AsWKB(geometry) AS geom_wkb
    FROM read_parquet('{buildings_path}', filename=true, hive_partitioning=1)
    WHERE bbox.xmin >= {min_lng} AND bbox.xmax <= {max_lng}
      AND bbox.ymin >= {min_lat} AND bbox.ymax <= {max_lat}
      AND (bbox.xmax - bbox.xmin) > 0.0005
      AND (bbox.ymax - bbox.ymin) > 0.0005
      AND subtype IN ('commercial', 'education', 'sports', 'entertainment')
      AND JSON_EXTRACT_STRING(names, '$.primary') IS NOT NULL
    LIMIT 2000
    """
    
    try:
        buildings_results = con.execute(buildings_query).fetchall()
        buildings_results = [(r[0], r[1], r[2], r[3], r[4], None) for r in buildings_results]
        results.extend(buildings_results)
    except Exception as e:
        print(f"⚠️ Buildings query failed: {e}")
    
    if close_conn:
        con.close()
    
    if not results:
        return None
    
    # Convert to GeoDataFrame
    polygons = []
    for row in results:
        poly_id, poly_name, poly_class, subtype, geom_wkb, area_sqm = row
        try:
            geom = shapely_wkb.loads(geom_wkb)
            polygons.append({
                'id': poly_id,
                'name': poly_name,
                'class': poly_class,
                'subtype': subtype,
                'geometry': geom,
                'area_sqm': area_sqm
            })
        except Exception:
            continue
    
    if not polygons:
        return None
    
    gdf = gpd.GeoDataFrame(polygons, geometry='geometry', crs='EPSG:4326')
    
    # Build spatial index for efficient queries
    gdf.sindex
    
    return gdf


def fetch_city_neighborhoods(bbox: List[float], con=None) -> Optional['gpd.GeoDataFrame']:
    """
    Fetch neighborhood polygons from Overture divisions theme for hierarchical spatial join.
    
    Joins division_area (geometries) with division (metadata) for subtypes:
    - 'neighborhood' (bairros - highest priority)
    - 'macrohood' (larger districts - fallback)
    
    Args:
        bbox: [min_lng, min_lat, max_lng, max_lat]
        con: Optional existing DuckDB connection
    
    Returns:
        GeoDataFrame with: division_id, neighborhood_name, subtype, geometry, area_sqm
        Sorted by area for efficient smallest-first matching.
    """
    if not GEOPANDAS_AVAILABLE:
        return None
    
    close_conn = False
    if con is None:
        con = duckdb.connect(':memory:')
        con.execute("INSTALL spatial; LOAD spatial;")
        con.execute("INSTALL httpfs; LOAD httpfs;")
        con.execute("SET s3_region='us-west-2';")
        close_conn = True
    
    min_lng, min_lat, max_lng, max_lat = bbox
    
    # Paths to divisions theme
    area_path = f"s3://overturemaps-us-west-2/release/{OVERTURE_RELEASE}/theme=divisions/type=division_area/*"
    division_path = f"s3://overturemaps-us-west-2/release/{OVERTURE_RELEASE}/theme=divisions/type=division/*"
    
    # Query joining division_area (polygons) with division (metadata)
    # Note: Overture names structure can vary - try primary first, fallback to primary[0].value
    query = f"""
    SELECT 
        area.division_id,
        COALESCE(
            JSON_EXTRACT_STRING(div.names, '$.primary'),
            JSON_EXTRACT_STRING(div.names, '$.primary[0].value')
        ) AS neighborhood_name,
        div.subtype,
        ST_AsWKB(area.geometry) AS geom_wkb,
        ST_Area_Spheroid(area.geometry) AS area_sqm
    FROM read_parquet('{area_path}', filename=true, hive_partitioning=1) AS area
    JOIN read_parquet('{division_path}', filename=true, hive_partitioning=1) AS div
        ON area.division_id = div.id
    WHERE div.subtype IN ('neighborhood', 'macrohood')
        AND area.bbox.xmin >= {min_lng} AND area.bbox.xmax <= {max_lng}
        AND area.bbox.ymin >= {min_lat} AND area.bbox.ymax <= {max_lat}
    """
    
    try:
        results = con.execute(query).fetchall()
        print(f"   🏘️  Loaded {len(results)} neighborhood polygons from Overture divisions")
    except Exception as e:
        print(f"❌ Failed to query divisions: {e}")
        results = []
    
    if close_conn:
        con.close()
    
    if not results:
        print("   ⚠️  No neighborhood polygons found for this city")
        return None
    
    # Convert to GeoDataFrame
    neighborhoods = []
    for row in results:
        div_id, name, subtype, geom_wkb, area_sqm = row
        if not name:
            continue
        try:
            geom = shapely_wkb.loads(geom_wkb)
            neighborhoods.append({
                'division_id': div_id,
                'neighborhood_name': name,
                'subtype': subtype,
                'geometry': geom,
                'area_sqm': area_sqm or 0
            })
        except Exception:
            continue
    
    if not neighborhoods:
        return None
    
    gdf = gpd.GeoDataFrame(neighborhoods, geometry='geometry', crs='EPSG:4326')
    
    # CRITICAL: Build R-Tree spatial index for 80k+ POI queries
    # This must be called before any spatial operations
    _ = gdf.sindex
    
    # Count by subtype for logging
    subtype_counts = gdf['subtype'].value_counts().to_dict()
    print(f"   📊 Neighborhood breakdown: {subtype_counts}")
    
    return gdf


def resolve_poi_neighborhood(
    poi_point: 'Point',
    neighborhoods_gdf: Optional['gpd.GeoDataFrame']
) -> Tuple[Optional[str], Optional[str]]:
    """
    Resolve the neighborhood name for a POI using hierarchical spatial join.
    
    Priority Logic (Hierarchical):
    1. subtype='neighborhood' takes priority over 'macrohood'
    2. If multiple matches within same subtype, smallest area wins (most specific)
    
    Args:
        poi_point: Shapely Point geometry of the POI
        neighborhoods_gdf: GeoDataFrame from fetch_city_neighborhoods()
    
    Returns:
        Tuple of (neighborhood_name, subtype) or (None, None) if no match
    """
    if neighborhoods_gdf is None or len(neighborhoods_gdf) == 0:
        return None, None
    
    if not GEOPANDAS_AVAILABLE:
        return None, None
    
    # Use spatial index for efficient candidate discovery
    possible_idx = list(neighborhoods_gdf.sindex.query(poi_point, predicate='intersects'))
    
    if not possible_idx:
        return None, None
    
    candidates = neighborhoods_gdf.iloc[possible_idx].copy()
    
    if candidates.empty:
        return None, None
    
    # HIERARCHICAL PRIORITY:
    # 1. Filter to 'neighborhood' subtype if any exist
    neighborhoods = candidates[candidates['subtype'] == 'neighborhood']
    if not neighborhoods.empty:
        candidates = neighborhoods
    else:
        # Fallback to macrohood
        macrohoods = candidates[candidates['subtype'] == 'macrohood']
        if not macrohoods.empty:
            candidates = macrohoods
    
    # 2. TIEBREAKER: Smallest area wins (most specific polygon)
    best = candidates.loc[candidates['area_sqm'].idxmin()]
    
    return best['neighborhood_name'], best['subtype']


def compute_poi_boundary(
    poi_geom_wkb: bytes,
    poi_name: str,
    poi_category: str,
    city_polygons_gdf: Optional['gpd.GeoDataFrame'],
    relevance_score: int = 0
) -> Optional[str]:
    """
    Compute the boundary geometry for a POI based on its category.
    
    Area categories: Spatial join → polygon match → 60m buffer expansion
    Point categories: 60m buffer around centroid
    
    Args:
        poi_geom_wkb: POI point geometry as WKB bytes
        poi_name: POI name for similarity matching
        poi_category: Internal category (e.g., 'park', 'bar')
        city_polygons_gdf: GeoDataFrame with city polygons
        relevance_score: POI relevance score for master selection
    
    Returns:
        Boundary geometry as WKB hex string, or None if unable to compute.
    """
    if not GEOPANDAS_AVAILABLE:
        return None
    
    try:
        poi_point = shapely_wkb.loads(poi_geom_wkb)
    except Exception:
        return None
    
    # ==========================================================================
    # AREA CATEGORIES: Try spatial join with polygon, fallback to large radius
    # ==========================================================================
    if poi_category in AREA_CATEGORIES:
        boundary = None
        
        # Try to find matching polygon
        if city_polygons_gdf is not None and len(city_polygons_gdf) > 0:
            boundary = _find_matching_polygon(
                poi_point, poi_name, poi_category, city_polygons_gdf
            )
        
        if boundary is not None:
            # Apply 60m safety buffer expansion
            boundary = _buffer_geometry(boundary, SAFETY_MARGIN_METERS)
        else:
            # Fallback: Generate circle with category-specific radius + safety margin
            radius = FALLBACK_RADIUS.get(poi_category, 300) + SAFETY_MARGIN_METERS
            boundary = _buffer_geometry(poi_point, radius)
        
        if boundary is not None:
            return boundary.wkb_hex
    
    # ==========================================================================
    # POINT CATEGORIES: Always use 60m buffer circle
    # ==========================================================================
    elif poi_category in POINT_CATEGORIES:
        boundary = _buffer_geometry(poi_point, SAFETY_MARGIN_METERS)
        if boundary is not None:
            return boundary.wkb_hex
    
    # ==========================================================================
    # UNKNOWN CATEGORY: Default 60m buffer
    # ==========================================================================
    else:
        boundary = _buffer_geometry(poi_point, SAFETY_MARGIN_METERS)
        if boundary is not None:
            return boundary.wkb_hex
    
    return None


def _find_matching_polygon(
    poi_point: 'Point',
    poi_name: str,
    poi_category: str,
    polygons_gdf: 'gpd.GeoDataFrame',
    debug: bool = False
) -> Optional[Any]:
    """
    Proximity Semantic Matcher - Find matching polygon using spatial proximity + semantic similarity.
    
    Strategy:
    1. Search within 450m radius (0.004 degrees) for area categories
    2. Score candidates: (similarity * 0.8) + (proximity * 0.2)
    3. Accept if: similarity > 0.7 OR exclusive category match within 100m
    """
    # Constants
    SEARCH_RADIUS_DEG = 0.004  # ~450m at equator
    MAX_DISTANCE_M = 450
    CLOSE_DISTANCE_M = 100
    MIN_SIMILARITY = 0.7
    
    # Expand search area for area categories
    search_buffer = poi_point.buffer(SEARCH_RADIUS_DEG)
    possible_idx = list(polygons_gdf.sindex.query(search_buffer, predicate='intersects'))
    
    if not possible_idx:
        if debug:
            print(f"[GEO-MATCH] POI '{poi_name}': No polygons within 450m radius")
        return None
    
    candidates = polygons_gdf.iloc[possible_idx].copy()
    
    # Apply category-aware class filtering
    # Note: land_use uses 'class', buildings use 'subtype' - check both
    valid_classes = VALID_LAND_USE_CLASSES.get(poi_category)
    if valid_classes:
        class_match = candidates['class'].isin(valid_classes)
        if 'subtype' in candidates.columns:
            subtype_match = candidates['subtype'].isin(valid_classes)
            class_filtered = candidates[class_match | subtype_match]
        else:
            class_filtered = candidates[class_match]
        if not class_filtered.empty:
            candidates = class_filtered
        elif debug:
            print(f"[GEO-MATCH] POI '{poi_name}': No polygons with valid classes/subtypes {valid_classes}")
    
    
    # Calculate distance to each candidate (approximate meters)
    # Project to Web Mercator for distance calculation
    try:
        candidates_proj = candidates.to_crs('EPSG:3857')
        poi_proj = gpd.GeoSeries([poi_point], crs='EPSG:4326').to_crs('EPSG:3857').iloc[0]
        candidates['distance_m'] = candidates_proj.geometry.distance(poi_proj)
    except Exception:
        # Fallback: approximate using degrees (1 deg ≈ 111km)
        candidates['distance_m'] = candidates.geometry.distance(poi_point) * 111000
    
    # Filter to max distance
    candidates = candidates[candidates['distance_m'] <= MAX_DISTANCE_M]
    
    if candidates.empty:
        if debug:
            print(f"[GEO-MATCH] POI '{poi_name}': All candidates > 450m away")
        return None
    
    # Calculate similarity scores
    if RAPIDFUZZ_AVAILABLE and poi_name:
        from rapidfuzz import fuzz as rfuzz
        
        def calc_similarity(poly_name):
            if not isinstance(poly_name, str):
                return 0.0
            return rfuzz.token_set_ratio(poi_name.lower(), poly_name.lower()) / 100.0
        
        candidates['similarity'] = candidates['name'].apply(calc_similarity)
    else:
        candidates['similarity'] = 0.0
    
    # Calculate proximity score (inversely proportional to distance)
    # 0m = 1.0, 450m = 0.0
    candidates['proximity_score'] = 1.0 - (candidates['distance_m'] / MAX_DISTANCE_M)
    candidates['proximity_score'] = candidates['proximity_score'].clip(0, 1)
    
    # Composite score: 80% similarity + 20% proximity
    candidates['composite_score'] = (candidates['similarity'] * 0.8) + (candidates['proximity_score'] * 0.2)
    
    # Sort by composite score (descending)
    candidates = candidates.sort_values('composite_score', ascending=False)
    
    best = candidates.iloc[0]
    
    # Acceptance criteria
    accepted = False
    reason = ""
    
    # Check if category matches (for both criteria)
    best_class = best.get('class')
    best_subtype = best.get('subtype')
    matches_class = False
    if valid_classes:
        matches_class = best_class in valid_classes or best_subtype in valid_classes
    
    # Criterion 1: High similarity (≥ 0.7) AND correct category
    # This prevents matching "Parque Barigui" with "Shopping Barigui"
    if best['similarity'] >= MIN_SIMILARITY and (not valid_classes or matches_class):
        accepted = True
        reason = f"similarity={best['similarity']:.2f}"
    
    # Criterion 2: Very close proximity (≤ 50m) with moderate similarity (≥ 0.5)
    # For cases where the name is slightly different in OSM but location is certain
    elif matches_class and best['distance_m'] <= 50 and best['similarity'] >= 0.5:
        accepted = True
        reason = f"{best_subtype or best_class} at {best['distance_m']:.0f}m (sim={best['similarity']:.2f})"
    
    if debug or (accepted and poi_name and 'shopping' in poi_name.lower()):
        dist = best['distance_m']
        sim = best['similarity']
        poly_name = best.get('name', 'N/A')
        status = "MATCHED" if accepted else "REJECTED"
        print(f"[GEO-MATCH] POI '{poi_name}' {status} → polygon '{poly_name}' at {dist:.0f}m (Sim: {sim:.2f})")
    
    if accepted:
        return best.geometry
    
    return None


def _buffer_geometry(geom: Any, meters: float) -> Optional[Any]:
    """
    Apply a buffer in meters to a geometry.
    Uses geography conversion for accurate meter-based buffering.
    """
    if not GEOPANDAS_AVAILABLE:
        return None
    
    try:
        # Convert to GeoDataFrame for projection
        gdf = gpd.GeoDataFrame(geometry=[geom], crs='EPSG:4326')
        
        # Project to a meter-based CRS, buffer, and reproject
        # Use Web Mercator (EPSG:3857) for approximate meter-based operations
        gdf_projected = gdf.to_crs('EPSG:3857')
        gdf_projected['geometry'] = gdf_projected.buffer(meters)
        gdf_back = gdf_projected.to_crs('EPSG:4326')
        
        result = gdf_back.geometry.iloc[0]
        
        # Validate geometry
        if not result.is_valid:
            result = make_valid(result)
        
        return result
    except Exception as e:
        print(f"   ⚠️ Buffer failed: {e}")
        return None


def export_geojson_by_category(
    pois: List[Dict],
    output_dir: str
) -> Dict[str, int]:
    """
    Export POIs with boundaries to GeoJSON files, separated by category.
    
    Args:
        pois: List of POI dicts with 'category', 'name', 'relevance_score', 'boundary_wkb_hex'
        output_dir: Directory to write GeoJSON files
    
    Returns:
        Dict mapping category -> count of exported features
    """
    if not GEOPANDAS_AVAILABLE:
        print("⚠️ GeoPandas not available - skipping GeoJSON export")
        return {}
    
    os.makedirs(output_dir, exist_ok=True)
    
    # Group POIs by category
    by_category: Dict[str, List[Dict]] = {}
    for poi in pois:
        cat = poi.get('category', 'unknown')
        boundary_hex = poi.get('boundary_wkb_hex')
        if not boundary_hex:
            continue
        
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append(poi)
    
    export_stats = {}
    
    for category, category_pois in by_category.items():
        features = []
        
        for poi in category_pois:
            try:
                boundary_bytes = bytes.fromhex(poi['boundary_wkb_hex'])
                boundary_geom = shapely_wkb.loads(boundary_bytes)
                
                feature = {
                    'type': 'Feature',
                    'properties': {
                        'name': poi.get('name', ''),
                        'relevance_score': poi.get('relevance_score', 0),
                        'category': category,
                        'polygon_class': poi.get('polygon_class', 'buffer')
                    },
                    'geometry': mapping(boundary_geom)
                }
                features.append(feature)
            except Exception:
                continue
        
        if not features:
            continue
        
        geojson = {
            'type': 'FeatureCollection',
            'features': features
        }
        
        output_path = os.path.join(output_dir, f'{category}.geojson')
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(geojson, f, indent=2, ensure_ascii=False)
        
        export_stats[category] = len(features)
        print(f"   📁 Exported {len(features)} features to {category}.geojson")
    
    print(f"✅ GeoJSON export complete: {sum(export_stats.values())} total features across {len(export_stats)} categories")
    
    return export_stats
