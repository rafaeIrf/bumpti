"""
Spatial deduplication module for POI processing.

Moves fuzzy matching from PostgreSQL to Python to eliminate database locks.
Uses KDTree for spatial clustering and rapidfuzz for name similarity.
"""

from typing import List, Tuple, Dict, Set
from dataclasses import dataclass
from scipy.spatial import KDTree
from rapidfuzz import fuzz
from unidecode import unidecode


@dataclass
class POI:
    """Point of Interest data structure."""
    name: str
    lat: float
    lng: float
    category: str
    overture_id: str
    relevance_score: int
    row_data: tuple  # Original row from DuckDB
    

def get_adaptive_radius(category: str) -> float:
    """
    Get deduplication radius in meters based on category.
    
    Matches SQL logic from migration 20260115000017 lines 121-124, 130-134.
    Large venues (parks, universities, stadiums) use 800m.
    All other categories use 50m.
    
    Args:
        category: Internal category name
        
    Returns:
        Radius in meters
    """
    LARGE_VENUES = {'park', 'university', 'stadium'}
    return 800.0 if category in LARGE_VENUES else 50.0


def normalize_name(name: str) -> str:
    """
    Normalize name for comparison.
    
    Matches SQL immutable_unaccent(lower(...)) logic.
    
    Args:
        name: Original place name
        
    Returns:
        Normalized name (lowercase, no accents)
    """
    if not name:
        return ""
    return unidecode(name.lower().strip())


def names_are_similar(name1: str, name2: str, threshold: float = 0.7) -> bool:
    """
    Check if two names are similar using fuzzy matching.
    
    Matches SQL similarity() > 0.7 logic (line 136).
    Uses rapidfuzz token_set_ratio for better handling of word order.
    
    Args:
        name1: First name
        name2: Second name
        threshold: Similarity threshold (0-1), default 0.7
        
    Returns:
        True if names are similar enough
    """
    norm1 = normalize_name(name1)
    norm2 = normalize_name(name2)
    
    if not norm1 or not norm2:
        return False
    
    # token_set_ratio handles word order variations
    # Returns 0-100, convert to 0-1 for threshold comparison
    similarity = fuzz.token_set_ratio(norm1, norm2) / 100.0
    return similarity > threshold


def deduplicate_pois_in_memory(
    pois_list: List[tuple],
    config: dict
) -> Tuple[List[tuple], Dict[str, str]]:
    """
    Deduplicate POIs using spatial clustering and fuzzy name matching.
    
    This eliminates the need for SQL fuzzy matching, preventing database locks.
    
    Algorithm:
    1. Build spatial index (KDTree) for fast radius queries
    2. For each POI, find nearby candidates within adaptive radius
    3. Check name similarity (>70%) and category match
    4. Group duplicates, elect winner (highest relevance_score)
    5. Return deduplicated list with overture_id mappings
    
    Args:
        pois_list: List of tuples from DuckDB query
                   Format: (overture_id, name, lat, lng, category, ..., relevance_score, ...)
        config: Curation configuration dict
        
    Returns:
        deduplicated_pois: List of unique POI tuples (one per physical location)
        overture_id_mappings: Dict mapping all overture_ids to their winning POI
    """
    if not pois_list:
        return [], {}
    
    # Parse POIs into structured format
    # DuckDB query columns (0-indexed):
    # 0: overture_id, 1: name, 2: overture_category, 3: alternate_categories,
    # 4: geom_wkb, 5: street, 6: neighborhood, 7: postal_code, 8: state,
    # 9: confidence, 10: source_raw, 11: websites, 12: socials,
    # 13: source_magnitude, 14: has_brand
    pois = []
    for row in pois_list:
        # Calculate simple quality score from available fields
        # (relevance_score is calculated later in validation loop)
        quality_score = 0
        quality_score += row[13] * 10 if row[13] else 0  # source_magnitude (more sources = better)
        quality_score += 50 if row[14] else 0  # has_brand (branded places prioritized)
        quality_score += int(row[9] * 100) if row[9] else 0  # confidence (0.7-1.0 → 70-100)
        
        # Get internal category from overture category
        # Note: This is a simplified mapping - full mapping happens in validation
        overture_cat = row[2]
        internal_cat = overture_cat  # Will be mapped properly later
        
        poi = POI(
            overture_id=row[0],
            name=row[1],
            lat=None,  # Extract from geom_wkb
            lng=None,  # Extract from geom_wkb
            category=internal_cat,
            relevance_score=quality_score,
            row_data=row
        )
        
        # Extract lat/lng from WKB geometry
        if row[4]:  # geom_wkb
            try:
                # WKB format: first byte is endianness, next 4 bytes are geometry type,
                # then 8 bytes for X (lng), 8 bytes for Y (lat)
                import struct
                wkb = row[4]
                # Skip first 5 bytes (endianness + type), read X and Y as doubles
                lng, lat = struct.unpack('<dd', wkb[5:21])
                poi.lat = lat
                poi.lng = lng
            except Exception:
                # Skip POIs with invalid geometry
                continue
        
        if poi.lat is None or poi.lng is None:
            continue
            
        pois.append(poi)
    
    # Build spatial index for fast radius queries
    # Convert lat/lng to approximate meters for KDTree
    # 1 degree ≈ 111km at equator
    coords = [(poi.lat * 111000, poi.lng * 111000) for poi in pois]
    tree = KDTree(coords)
    
    # Track which POIs have been merged
    merged_into: Dict[int, int] = {}  # poi_index -> winner_index
    clusters: Dict[int, Set[int]] = {}  # winner_index -> set of merged indices
    
    # Process each POI
    for i, poi in enumerate(pois):
        if i in merged_into:
            continue  # Already merged into another POI
        
        # Get adaptive radius for this category
        radius_meters = get_adaptive_radius(poi.category)
        
        # Find nearby POIs within radius
        nearby_indices = tree.query_ball_point(coords[i], radius_meters)
        
        # Check each nearby POI for potential duplicate
        for j in nearby_indices:
            if i == j or j in merged_into:
                continue
            
            other = pois[j]
            
            # Category must match (or one is NULL)
            if poi.category and other.category and poi.category != other.category:
                continue
            
            # Name must be similar (>70%)
            if not names_are_similar(poi.name, other.name):
                continue
            
            # Found a duplicate! Determine winner
            if poi.relevance_score >= other.relevance_score:
                # Current POI wins
                merged_into[j] = i
                if i not in clusters:
                    clusters[i] = {i}
                clusters[i].add(j)
            else:
                # Other POI wins
                merged_into[i] = j
                if j not in clusters:
                    clusters[j] = {j}
                clusters[j].add(i)
                break  # Current POI is merged, stop checking
    
    # Build deduplicated list and mappings
    deduplicated = []
    overture_id_mappings = {}
    
    for i, poi in enumerate(pois):
        if i in merged_into:
            # This POI was merged into another
            winner_idx = merged_into[i]
            winner_poi = pois[winner_idx]
            overture_id_mappings[poi.overture_id] = winner_poi.overture_id
        else:
            # This POI is a winner (or standalone)
            deduplicated.append(poi.row_data)
            overture_id_mappings[poi.overture_id] = poi.overture_id
            
            # Map all merged POIs to this winner
            if i in clusters:
                for merged_idx in clusters[i]:
                    if merged_idx != i:
                        merged_poi = pois[merged_idx]
                        overture_id_mappings[merged_poi.overture_id] = poi.overture_id
    
    print(f"🧹 Deduplication: {len(pois)} POIs → {len(deduplicated)} unique ({len(pois) - len(deduplicated)} duplicates removed)")
    
    return deduplicated, overture_id_mappings
