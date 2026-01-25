"""
Simple Exact Duplicate Removal for POI Deduplication.

Rule: Remove only POIs with EXACTLY the same:
- Name (normalized: lowercase, no accents)
- Street (normalized: lowercase, no accents)
- House Number (normalized: lowercase, no accents)

Winner Selection:
1. Most complete data (has street, house_number, postcode)
2. Highest relevance_score
3. Random if tied
"""

from typing import List, Tuple, Dict
from dataclasses import dataclass
from enum import IntEnum
from unidecode import unidecode


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


def normalize_text(text: str) -> str:
    """
    Normalize text for comparison.
    
    Steps:
    1. Remove accents (unidecode)
    2. Lowercase
    3. Strip whitespace
    
    Examples:
        "Parque Barigüi" → "parque barigui"
        "Rua José da Silva" → "rua jose da silva"
        "  123  " → "123"
    
    Args:
        text: Original text
        
    Returns:
        Normalized text (lowercase, no accents)
    """
    if not text:
        return ""
    
    # Remove accents
    normalized = unidecode(text)
    
    # Lowercase and strip
    normalized = normalized.lower().strip()
    
    return normalized


def calculate_completeness_score(row: tuple) -> int:
    """
    Calculate data completeness score for winner selection.
    
    Score factors:
    - Has street: +10
    - Has house_number: +10
    - Has postal_code: +10
    - Has websites: +5
    - Has socials: +5
    - relevance_score: as-is
    
    Args:
        row: DuckDB row tuple
        
    Returns:
        Completeness score (higher = more complete)
    """
    score = 0
    
    # Address completeness (most important)
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
    
    # Relevance score (quality indicator)
    # Already calculated in hydrate_overture_city.py
    # Use confidence as proxy
    if row[POIColumn.CONFIDENCE]:
        score += int(row[POIColumn.CONFIDENCE] * 100)
    
    return score


def deduplicate_pois_in_memory(
    pois_list: List[tuple],
    config: dict
) -> Tuple[List[tuple], Dict[str, str], Dict[str, tuple]]:
    """
    Remove duplicates based on normalized name + spatial proximity.
    
    Proximity thresholds by category:
    - Large venues (parks, stadiums, shopping, universities): 500m
    - Other categories: 30m
    
    Algorithm:
    1. For each POI, create dedup key from normalized name
    2. Group POIs by name key
    3. Within each name group, cluster by proximity (category-aware threshold)
    4. For each cluster, select winner with highest completeness
    
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
    
    # Import shapely for geometry operations
    try:
        from shapely import wkb as shapely_wkb
        HAS_SHAPELY = True
    except ImportError:
        HAS_SHAPELY = False
    
    # Category-aware proximity thresholds
    LARGE_VENUE_CATEGORIES = {
        'park', 'stadium', 'shopping', 'university', 'botanical_garden', 
        'event_venue', 'sports_centre', 'recreation_ground', 'plaza'
    }
    LARGE_VENUE_THRESHOLD_M = 500
    DEFAULT_THRESHOLD_M = 30
    DEG_TO_M = 111000  # Approximate meters per degree at equator
    
    # Build category map from config
    category_map = config.get('categories', {}).get('mapping', {})
    
    # Group POIs by normalized name
    name_groups = {}  # normalized_name → [poi_idx, ...]
    all_pois_data = {}  # overture_id → row
    
    for idx, row in enumerate(pois_list):
        overture_id = row[POIColumn.OVERTURE_ID]
        all_pois_data[overture_id] = row
        
        norm_name = normalize_text(row[POIColumn.NAME])
        
        if norm_name not in name_groups:
            name_groups[norm_name] = []
        name_groups[norm_name].append(idx)
    
    # Process each name group
    winners = []
    duplicate_mappings = {}
    
    for norm_name, poi_indices in name_groups.items():
        if len(poi_indices) == 1:
            # Single POI with this name, no duplicates
            winners.append(pois_list[poi_indices[0]])
            continue
        
        # Determine proximity threshold based on category of first POI in group
        first_row = pois_list[poi_indices[0]]
        overture_cat = first_row[POIColumn.OVERTURE_CATEGORY]
        internal_cat = category_map.get(overture_cat, '')
        
        if internal_cat in LARGE_VENUE_CATEGORIES:
            proximity_threshold = LARGE_VENUE_THRESHOLD_M
        else:
            proximity_threshold = DEFAULT_THRESHOLD_M
        
        # Multiple POIs with same name - cluster by proximity
        if HAS_SHAPELY:
            # Extract coordinates for spatial clustering
            poi_coords = []
            for idx in poi_indices:
                row = pois_list[idx]
                geom_wkb = row[POIColumn.GEOM_WKB]
                if geom_wkb:
                    try:
                        point = shapely_wkb.loads(geom_wkb)
                        poi_coords.append((idx, point.x, point.y))
                    except Exception:
                        poi_coords.append((idx, None, None))
                else:
                    poi_coords.append((idx, None, None))
            
            # Simple clustering: assign each POI to nearest cluster or create new one
            clusters = []  # List of [(idx, x, y), ...]
            
            for poi_data in poi_coords:
                idx, x, y = poi_data
                if x is None or y is None:
                    # No coords, treat as unique
                    clusters.append([poi_data])
                    continue
                
                # Find if this POI is within threshold of an existing cluster
                assigned = False
                for cluster in clusters:
                    # Check distance to first POI in cluster
                    ref_idx, ref_x, ref_y = cluster[0]
                    if ref_x is None:
                        continue
                    
                    # Approximate distance in meters
                    dist_deg = ((x - ref_x)**2 + (y - ref_y)**2)**0.5
                    dist_m = dist_deg * DEG_TO_M
                    
                    if dist_m <= proximity_threshold:
                        cluster.append(poi_data)
                        assigned = True
                        break
                
                if not assigned:
                    clusters.append([poi_data])
            
            # Select winner from each cluster
            for cluster in clusters:
                cluster_indices = [p[0] for p in cluster]
                
                if len(cluster_indices) == 1:
                    winners.append(pois_list[cluster_indices[0]])
                else:
                    # Multiple POIs in cluster, select by completeness
                    scores = []
                    for idx in cluster_indices:
                        row = pois_list[idx]
                        completeness = calculate_completeness_score(row)
                        scores.append((completeness, idx))
                    
                    scores.sort(reverse=True)
                    winner_idx = scores[0][1]
                    winner_row = pois_list[winner_idx]
                    winner_id = winner_row[POIColumn.OVERTURE_ID]
                    
                    winners.append(winner_row)
                    
                    # Map losers to winner
                    for _, loser_idx in scores[1:]:
                        loser_row = pois_list[loser_idx]
                        loser_id = loser_row[POIColumn.OVERTURE_ID]
                        duplicate_mappings[loser_id] = winner_id
        else:
            # Fallback: no spatial clustering, use first as winner
            winner_row = pois_list[poi_indices[0]]
            winner_id = winner_row[POIColumn.OVERTURE_ID]
            winners.append(winner_row)
            
            for idx in poi_indices[1:]:
                loser_row = pois_list[idx]
                loser_id = loser_row[POIColumn.OVERTURE_ID]
                duplicate_mappings[loser_id] = winner_id
    
    num_removed = len(pois_list) - len(winners)
    print(f"🧹 Simple Dedup: {len(pois_list)} POIs → {len(winners)} unique ({num_removed} exact duplicates removed)")
    
    return winners, duplicate_mappings, all_pois_data
