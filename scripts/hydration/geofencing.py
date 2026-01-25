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
    'park',
    'stadium', 
    'university',
    'shopping_mall',
    'botanical_garden',
    'event_venue'
}

# Categories that use point-based boundaries (precision circles)
POINT_CATEGORIES = {
    'bar',
    'nightclub',
    'restaurant',
    'cafe',
    'gym',
    'club',
    'plaza',
    'museum',
    'theatre',
    'library',
    'community_centre',
    'sports_centre',
    'language_school',
    'commercial_center',
    'skate_park'
}

# Fallback radius (in meters) for area categories without polygon matches
FALLBACK_RADIUS = {
    'park': 500,
    'university': 150,
    'botanical_garden': 300,
    'stadium': 300,
    'shopping_mall': 300,
    'event_venue': 300,
}

# Safety margin (in meters) for GPS error compensation
SAFETY_MARGIN_METERS = 60

# Land-use class whitelist per category (prevents incorrect polygon associations)
VALID_LAND_USE_CLASSES = {
    'park': {'park', 'recreation_ground', 'protected_landscape_seascape', 'natural_monument', 'meadow', 'grass', 'playground'},
    'plaza': {'plaza', 'pedestrian'},
    'botanical_garden': {'park', 'recreation_ground'},
    'university': {'university', 'college'},
    'shopping_mall': {'retail', 'commercial'},
}

# Overture release version for polygon sources
OVERTURE_RELEASE = '2025-12-17.0'


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
    valid_classes = VALID_LAND_USE_CLASSES.get(poi_category)
    if valid_classes:
        class_filtered = candidates[candidates['class'].isin(valid_classes)]
        if not class_filtered.empty:
            candidates = class_filtered
        elif debug:
            print(f"[GEO-MATCH] POI '{poi_name}': No polygons with valid classes {valid_classes}")
    
    if candidates.empty:
        return None
    
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
    
    # Criterion 1: High similarity (> 0.7)
    if best['similarity'] >= MIN_SIMILARITY:
        accepted = True
        reason = f"similarity={best['similarity']:.2f}"
    
    # Criterion 2: Correct category class AND exclusive within 100m
    elif valid_classes and best['class'] in valid_classes:
        close_competitors = candidates[candidates['distance_m'] <= CLOSE_DISTANCE_M]
        if len(close_competitors) == 1:
            accepted = True
            reason = f"exclusive class '{best['class']}' within 100m"
        elif best['distance_m'] <= CLOSE_DISTANCE_M:
            # Accept if it's the only one very close
            accepted = True
            reason = f"class '{best['class']}' at {best['distance_m']:.0f}m"
    
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
