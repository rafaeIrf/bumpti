"""
Elite POI Deduplication with Polygon Dominance.

Features:
- Fuzzy name matching (rapidfuzz, >75% similarity)
- Polygon dominance: real polygons win over buffer circles
- Spatial intersection for candidate selection
- Category protection: different categories never merge
- R-Tree spatial indexing for performance
"""

from typing import List, Tuple, Dict, Optional, Any
from dataclasses import dataclass
from enum import IntEnum
from unidecode import unidecode

# Optional imports
try:
    from rapidfuzz import fuzz
    HAS_RAPIDFUZZ = True
except ImportError:
    HAS_RAPIDFUZZ = False

try:
    from shapely import wkb as shapely_wkb
    from shapely.geometry import Point
    import geopandas as gpd
    HAS_GEOPANDAS = True
except ImportError:
    HAS_GEOPANDAS = False


class POIColumn(IntEnum):
    """DuckDB query column indices - eliminates magic numbers."""
    OVERTURE_ID = 0
    NAME = 1
    OVERTURE_CATEGORY = 2
    ALTERNATE_CATEGORIES = 3
    GEOM_WKB = 4
    STREET = 5
    HOUSE_NUMBER = 6
    NEIGHBORHOOD = 7
    POSTAL_CODE = 8
    STATE = 9
    CONFIDENCE = 10
    SOURCE_RAW = 11
    WEBSITES = 12
    SOCIALS = 13
    SOURCE_MAGNITUDE = 14
    HAS_BRAND = 15
    TAXONOMY_HIERARCHY = 16   # NEW: taxonomy.hierarchy path array


# Configuration constants
FUZZY_THRESHOLD = 0.90  # 90% similarity required (avoid false positives like "Restaurante X" vs "Restaurante Y")
# Note: Uses INTERNAL categories (after mapping). botanical_garden → park, shopping_mall → shopping
LARGE_VENUE_CATEGORIES = {
    'park', 'stadium', 'shopping', 'university', 'event_venue', 'club'
}
LARGE_VENUE_THRESHOLD_M = 1500  # 1.5km - large venues with similar names are usually duplicates
DEFAULT_THRESHOLD_M = 30
DEG_TO_M = 111000  # Approximate meters per degree


def normalize_text(text: str) -> str:
    """Normalize text for comparison: lowercase, no accents, stripped."""
    if not text:
        return ""
    return unidecode(text).lower().strip()


def fuzzy_match(name1: str, name2: str) -> float:
    """
    Calculate fuzzy similarity between two names.
    Returns value between 0.0 and 1.0.
    """
    if not HAS_RAPIDFUZZ:
        # Fallback: exact match only
        return 1.0 if normalize_text(name1) == normalize_text(name2) else 0.0
    
    norm1 = normalize_text(name1)
    norm2 = normalize_text(name2)
    
    if not norm1 or not norm2:
        return 0.0
    
    # token_set_ratio handles word reordering and partial matches
    return fuzz.token_set_ratio(norm1, norm2) / 100.0


def is_real_polygon(geom) -> bool:
    """
    Determine if geometry is a real polygon (from Overture) vs a buffer circle.
    
    Real polygons have irregular shapes; buffers are near-perfect circles.
    We detect circles by checking if the geometry has many vertices forming
    a regular pattern (typical of buffer operations).
    """
    if geom is None:
        return False
    
    geom_type = geom.geom_type
    
    if geom_type == 'Point':
        return False
    
    if geom_type in ['Polygon', 'MultiPolygon']:
        # Get exterior coordinates
        if geom_type == 'MultiPolygon':
            coords = list(geom.geoms[0].exterior.coords)
        else:
            coords = list(geom.exterior.coords)
        
        num_vertices = len(coords)
        
        # Buffers typically have 32-64 vertices in a perfect circle
        # Real polygons usually have fewer, irregular vertices
        # Exception: very detailed real polygons can have many vertices
        
        if num_vertices >= 30:
            # Check if it's suspiciously circular (regularity test)
            # Calculate variance in distances from centroid
            centroid = geom.centroid
            distances = [Point(c).distance(centroid) for c in coords]
            if distances:
                mean_dist = sum(distances) / len(distances)
                variance = sum((d - mean_dist) ** 2 for d in distances) / len(distances)
                # Low variance = circular (buffer), high variance = irregular (real polygon)
                relative_variance = variance / (mean_dist ** 2) if mean_dist > 0 else 0
                # Threshold: buffers have relative variance < 0.001
                return relative_variance > 0.001
        
        # Fewer vertices = likely real polygon
        return True
    
    return False


def calculate_completeness_score(row: tuple, has_real_polygon: bool = False) -> int:
    """
    Calculate data completeness score for winner selection.
    
    Score factors:
    - Has real polygon: +1000 (dominant factor)
    - Has street: +10
    - Has house_number: +10
    - Has postal_code: +10
    - Has websites: +5
    - Has socials: +5
    - Confidence score: +0-100 (higher confidence = better data quality)
    """
    score = 0
    
    # POLYGON DOMINANCE: Real polygons get massive bonus
    if has_real_polygon:
        score += 1000
    
    # Address completeness
    if row[POIColumn.STREET]:
        score += 10
    if row[POIColumn.HOUSE_NUMBER]:
        score += 10
    if row[POIColumn.POSTAL_CODE]:
        score += 10
    
    # Additional data
    if row[POIColumn.WEBSITES]:
        score += 5
    if row[POIColumn.SOCIALS]:
        score += 5
    
    # Confidence score (from Overture data quality)
    if row[POIColumn.CONFIDENCE]:
        score += int(row[POIColumn.CONFIDENCE] * 100)
    
    return score


def deduplicate_pois_in_memory(
    pois_list: List[tuple],
    config: dict
) -> Tuple[List[tuple], Dict[str, str], Dict[str, tuple]]:
    """
    Elite deduplication with fuzzy matching and polygon dominance.
    
    Algorithm:
    1. Build GeoDataFrame with all POIs and their boundaries
    2. Use R-Tree spatial index to find intersecting candidates
    3. For intersecting pairs with same category and fuzzy name match (>75%):
       - Elect winner based on: real polygon > buffer, then completeness
       - Map loser to winner
    4. Also cluster by proximity + exact name (legacy behavior)
    
    Args:
        pois_list: List of tuples from DuckDB query
        config: Curation configuration dict
        
    Returns:
        winners: List of unique POI tuples
        duplicate_mappings: Dict[loser_id → winner_id]
        all_pois_data: Dict[overture_id → POI tuple]
    """
    if not pois_list:
        return [], {}, {}
    
    # Build basic data structures
    all_pois_data = {}
    category_map = config.get('categories', {}).get('mapping', {})
    
    for row in pois_list:
        overture_id = row[POIColumn.OVERTURE_ID]
        all_pois_data[overture_id] = row
    
    # If geopandas not available, fall back to simple dedup
    if not HAS_GEOPANDAS:
        return _simple_dedup(pois_list, config, all_pois_data, category_map)
    
    # ========================================================================
    # PHASE 1: Build GeoDataFrame with geometries
    # ========================================================================
    print("🔬 Elite Dedup: Building spatial index...")
    
    poi_geometries = []
    for idx, row in enumerate(pois_list):
        geom_wkb = row[POIColumn.GEOM_WKB]
        geom = None
        if geom_wkb:
            try:
                geom = shapely_wkb.loads(geom_wkb)
            except Exception:
                pass
        
        overture_cat = row[POIColumn.OVERTURE_CATEGORY]
        internal_cat = category_map.get(overture_cat, overture_cat)
        
        poi_geometries.append({
            'idx': idx,
            'overture_id': row[POIColumn.OVERTURE_ID],
            'name': row[POIColumn.NAME],
            'norm_name': normalize_text(row[POIColumn.NAME]),
            'category': internal_cat,
            'geometry': geom,
            'is_real_polygon': is_real_polygon(geom) if geom else False,
            'merged_into': None  # Track if this POI was merged
        })
    
    gdf = gpd.GeoDataFrame(poi_geometries, geometry='geometry', crs='EPSG:4326')
    
    # Build spatial index
    gdf.sindex
    
    # ========================================================================
    # PHASE 2: Find and merge intersecting duplicates
    # ========================================================================
    print("🔬 Elite Dedup: Finding intersecting duplicates...")
    
    merge_count = 0
    
    # Process each POI
    for i, row_i in gdf.iterrows():
        if row_i['merged_into'] is not None:
            continue  # Already merged
        
        if row_i['geometry'] is None:
            continue
        
        # Find candidates that intersect with this POI's geometry
        # Use buffer for points to create search area
        search_geom = row_i['geometry']
        if search_geom.geom_type == 'Point':
            # Create 1.5km search buffer for points (covers large venues)
            search_geom = search_geom.buffer(0.015)  # ~1.5km
        
        possible_idx = list(gdf.sindex.query(search_geom, predicate='intersects'))
        
        for j in possible_idx:
            if i >= j:  # Avoid duplicate comparisons
                continue
            
            row_j = gdf.iloc[j]
            
            if row_j['merged_into'] is not None:
                continue  # Already merged
            
            if row_j['geometry'] is None:
                continue
            
            # CATEGORY PROTECTION: Different categories never merge
            if row_i['category'] != row_j['category']:
                continue
            
            # FUZZY NAME MATCH: Require >75% similarity
            similarity = fuzzy_match(row_i['name'], row_j['name'])
            if similarity < FUZZY_THRESHOLD:
                continue
            
            # Check actual intersection (not just bounding box)
            try:
                if not row_i['geometry'].intersects(row_j['geometry']):
                    # Check proximity as fallback
                    dist = row_i['geometry'].distance(row_j['geometry'])
                    threshold_deg = (LARGE_VENUE_THRESHOLD_M if row_i['category'] in LARGE_VENUE_CATEGORIES 
                                    else DEFAULT_THRESHOLD_M) / DEG_TO_M
                    if dist > threshold_deg:
                        continue
            except Exception:
                continue
            
            # MATCH FOUND - Determine winner (polygon dominance)
            i_score = calculate_completeness_score(
                pois_list[row_i['idx']], 
                has_real_polygon=row_i['is_real_polygon']
            )
            j_score = calculate_completeness_score(
                pois_list[row_j['idx']], 
                has_real_polygon=row_j['is_real_polygon']
            )
            
            if i_score >= j_score:
                winner_idx, loser_idx = i, j
                winner_row, loser_row = row_i, row_j
            else:
                winner_idx, loser_idx = j, i
                winner_row, loser_row = row_j, row_i
            
            # Mark loser as merged
            gdf.at[loser_idx, 'merged_into'] = winner_row['overture_id']
            
            # Log the merge
            polygon_indicator = "🔷" if winner_row['is_real_polygon'] else "⚪"
            print(f"[DEDUP-ELITE] '{loser_row['name']}' unificado ao polígono de "
                  f"'{winner_row['name']}' {polygon_indicator} (Similaridade: {similarity:.0%})")
            
            merge_count += 1
    
    # ========================================================================
    # PHASE 3: Build results
    # ========================================================================
    winners = []
    duplicate_mappings = {}
    
    for _, row in gdf.iterrows():
        if row['merged_into'] is None:
            # This POI survived - it's a winner
            winners.append(pois_list[row['idx']])
        else:
            # This POI was merged
            loser_id = row['overture_id']
            winner_id = row['merged_into']
            duplicate_mappings[loser_id] = winner_id
    
    num_removed = len(pois_list) - len(winners)
    print(f"🧹 Elite Dedup: {len(pois_list)} POIs → {len(winners)} unique "
          f"({merge_count} polygon-aware merges, {num_removed} total removed)")
    
    return winners, duplicate_mappings, all_pois_data


def _simple_dedup(
    pois_list: List[tuple],
    config: dict,
    all_pois_data: Dict[str, tuple],
    category_map: Dict[str, str]
) -> Tuple[List[tuple], Dict[str, str], Dict[str, tuple]]:
    """Fallback simple deduplication when geopandas not available."""
    
    # Group by normalized name + category
    groups = {}
    
    for idx, row in enumerate(pois_list):
        norm_name = normalize_text(row[POIColumn.NAME])
        overture_cat = row[POIColumn.OVERTURE_CATEGORY]
        internal_cat = category_map.get(overture_cat, overture_cat)
        
        key = (norm_name, internal_cat)
        if key not in groups:
            groups[key] = []
        groups[key].append(idx)
    
    winners = []
    duplicate_mappings = {}
    
    for key, indices in groups.items():
        if len(indices) == 1:
            winners.append(pois_list[indices[0]])
        else:
            # Select winner by completeness
            scores = [(calculate_completeness_score(pois_list[idx]), idx) for idx in indices]
            scores.sort(reverse=True)
            
            winner_idx = scores[0][1]
            winner_row = pois_list[winner_idx]
            winner_id = winner_row[POIColumn.OVERTURE_ID]
            
            winners.append(winner_row)
            
            for _, loser_idx in scores[1:]:
                loser_row = pois_list[loser_idx]
                loser_id = loser_row[POIColumn.OVERTURE_ID]
                duplicate_mappings[loser_id] = winner_id
    
    num_removed = len(pois_list) - len(winners)
    print(f"🧹 Simple Dedup: {len(pois_list)} POIs → {len(winners)} unique ({num_removed} removed)")
    
    return winners, duplicate_mappings, all_pois_data
