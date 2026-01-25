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
    'shopping',
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
    'language_school'
}

# Fallback radius (in meters) for area categories without polygon matches
FALLBACK_RADIUS = {
    'park': 500,
    'university': 500,
    'botanical_garden': 500,
    'stadium': 300,
    'shopping': 300,
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
    'shopping': {'retail', 'commercial'},
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
        print("⚠️ GeoPandas not available - skipping polygon fetch")
        return None
    
    print(f"🗺️ Fetching city polygons for geofencing...")
    
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
        ST_Area(geometry::geography) AS area_sqm
    FROM read_parquet('{land_use_path}', filename=true, hive_partitioning=1)
    WHERE bbox.xmin >= {min_lng} AND bbox.xmax <= {max_lng}
      AND bbox.ymin >= {min_lat} AND bbox.ymax <= {max_lat}
      AND class IN ('park', 'recreation_ground', 'university', 'college', 'retail', 'commercial', 'plaza', 'pedestrian')
    LIMIT 50000
    """
    
    try:
        results = con.execute(query).fetchall()
        print(f"   ✅ Loaded {len(results):,} polygons from land_use theme")
    except Exception as e:
        print(f"   ❌ Failed to query land_use: {e}")
        results = []
    
    # Also query buildings theme for large structures (optional enhancement)
    buildings_path = f"s3://overturemaps-us-west-2/release/{OVERTURE_RELEASE}/theme=buildings/type=building/*"
    
    buildings_query = f"""
    SELECT
        id,
        JSON_EXTRACT_STRING(names, '$.primary') AS poly_name,
        'building' AS class,
        subtype,
        ST_AsWKB(geometry) AS geom_wkb,
        ST_Area(geometry::geography) AS area_sqm
    FROM read_parquet('{buildings_path}', filename=true, hive_partitioning=1)
    WHERE bbox.xmin >= {min_lng} AND bbox.xmax <= {max_lng}
      AND bbox.ymin >= {min_lat} AND bbox.ymax <= {max_lat}
      AND ST_Area(geometry::geography) > 5000  -- Only large buildings (>5000 sqm)
    LIMIT 10000
    """
    
    try:
        buildings_results = con.execute(buildings_query).fetchall()
        print(f"   ✅ Loaded {len(buildings_results):,} large buildings")
        results.extend(buildings_results)
    except Exception as e:
        print(f"   ⚠️ Buildings query failed (continuing without): {e}")
    
    if close_conn:
        con.close()
    
    if not results:
        print("   ⚠️ No polygons found in city bbox")
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
    gdf.sindex  # Forces R-Tree creation
    
    print(f"   ✅ Created GeoDataFrame with {len(gdf):,} polygons (spatial index built)")
    
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
    polygons_gdf: 'gpd.GeoDataFrame'
) -> Optional[Any]:
    """
    Find a matching polygon for an area-category POI using spatial join.
    
    Applies:
    1. Point-in-polygon check (ST_Within equivalent)
    2. Land-use class filtering based on category
    3. Name similarity validation (>0.8) or area-based master selection
    """
    # Use spatial index for efficient query
    possible_idx = list(polygons_gdf.sindex.query(poi_point, predicate='intersects'))
    
    if not possible_idx:
        return None
    
    candidates = polygons_gdf.iloc[possible_idx]
    
    # Filter to polygons that actually contain the point
    containing = candidates[candidates.contains(poi_point)]
    
    if containing.empty:
        return None
    
    # Apply category-aware class filtering
    valid_classes = VALID_LAND_USE_CLASSES.get(poi_category)
    if valid_classes:
        class_filtered = containing[containing['class'].isin(valid_classes)]
        if not class_filtered.empty:
            containing = class_filtered
    
    # Name similarity check (if rapidfuzz available)
    if RAPIDFUZZ_AVAILABLE and poi_name:
        best_match = None
        best_score = 0.0
        
        for idx, row in containing.iterrows():
            poly_name = row.get('name', '')
            if poly_name:
                score = fuzz.ratio(poi_name.lower(), poly_name.lower()) / 100.0
                if score > best_score:
                    best_score = score
                    best_match = row
        
        # Accept if similarity > 0.8
        if best_score >= 0.8 and best_match is not None:
            return best_match.geometry
    
    # Fallback: Return smallest matching polygon (most specific)
    smallest = containing.loc[containing['area_sqm'].idxmin()]
    return smallest.geometry


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
