"""
Entity Resolution Module for POI Deduplication.

Implements production-grade entity resolution using:
- Normalization keys (deterministic, language-agnostic)
- Address anchoring (house_number/postal_code matching)
- GERS ID priority (Overture official IDs)
- Non-destructive merge (preserve all sources)
"""

from typing import List, Tuple, Dict, Set
from dataclasses import dataclass
from enum import IntEnum
import numpy as np
from scipy.spatial import KDTree
from rapidfuzz import fuzz
from unidecode import unidecode
import re


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


@dataclass
class POI:
    """Point of Interest data structure."""
    name: str
    lat: float
    lng: float
    category: str
    overture_id: str
    house_number: str
    postal_code: str
    relevance_score: int
    normalization_key: str
    row_data: tuple


# Stopwords to remove (global connectors, language-agnostic)
STOPWORDS = {
    'de', 'do', 'da', 'dos', 'das',  # Portuguese
    'the', 'and', 'of', 'in', 'at',  # English
    'el', 'la', 'los', 'las', 'de', 'del',  # Spanish
    'le', 'la', 'les', 'du', 'de',  # French
}


def generate_normalization_key(name: str) -> str:
    """
    Generate deterministic comparison key for entity resolution.
    
    Algorithm:
    1. Remove accents (via unidecode)
    2. Convert to lowercase
    3. Remove special characters (keep alphanumeric only)
    4. Remove stopwords (de, do, da, the, and, etc.)
    5. Split into tokens
    6. Sort tokens alphabetically
    7. Join with space
    
    This creates a canonical form for name comparison that is:
    - Language-agnostic (works globally)
    - Deterministic (same input = same output)
    - Order-independent (word order doesn't matter)
    
    Examples:
        "Bar do Alemão" → "alemao bar"
        "Parque Barigüi" → "barigui parque"
        "McDonald's #123" → "123 mcdonalds"
        "The Grand Hotel" → "grand hotel"
    
    Args:
        name: Original place name
        
    Returns:
        Normalized key string
    """
    if not name:
        return ""
    
    # Step 1: Remove accents
    normalized = unidecode(name)
    
    # Step 2: Lowercase
    normalized = normalized.lower()
    
    # Step 3: Remove special characters (keep alphanumeric and spaces)
    normalized = re.sub(r'[^a-z0-9\s]', ' ', normalized)
    
    # Step 4 & 5: Split into tokens and remove stopwords
    tokens = [
        token for token in normalized.split()
        if token and token not in STOPWORDS
    ]
    
    # Step 6: Sort alphabetically
    tokens.sort()
    
    # Step 7: Join
    return ' '.join(tokens)


def has_matching_address_anchor(poi1: POI, poi2: POI) -> bool:
    """
    Check if two POIs share the same address identifiers.
    
    Rigor Rules:
    1. If both have house_number:
       - MUST be identical → same entity
       - Different → different entities (even if names match)
    
    2. If one has house_number, other doesn't:
       - Fall back to postal_code check
    
    3. If both have postal_code:
       - MUST be identical → same entity
       - Different → different entities
    
    4. If neither has identifiers:
       - Return True (rely on name matching only)
    
    This prevents merging establishments at different addresses:
    - "Bar A, Rua X #100" ≠ "Bar A, Rua X #102"
    - "Café Y, CEP 80000" ≠ "Café Y, CEP 80100"
    
    Args:
        poi1: First POI
        poi2: Second POI
        
    Returns:
        True if addresses match or no anchor available, False otherwise
    """
    # Rule 1: Both have house numbers
    if poi1.house_number and poi2.house_number:
        # MUST be identical
        return poi1.house_number.strip() == poi2.house_number.strip()
    
    # Rule 2 & 3: Check postal_code
    if poi1.postal_code and poi2.postal_code:
        # MUST be identical
        return poi1.postal_code.strip() == poi2.postal_code.strip()
    
    # Rule 4: No address identifiers available
    # Fall back to name-only matching
    return True


def are_same_entity(poi1: POI, poi2: POI, use_fuzzy_tiebreak: bool = True) -> bool:
    """
    Determine if two POIs represent the same real-world entity.
    
    Priority Matching (top to bottom):
    
    1. GERS ID Priority (Overture Official ID):
       - If same overture_id → SAME ENTITY (100% confidence)
       - Overture already deduplicated these at source
    
    2. Exact Normalization Key + Address:
       - norm_key1 == norm_key2 AND
       - has_matching_address_anchor() → SAME ENTITY
    
    3. Fuzzy Tiebreak (optional, > 0.95 similarity):
       - norm_key_similarity > 0.95 AND
       - has_matching_address_anchor() → SAME ENTITY
       - Example: "Parque Barigui" vs "Parque Barigüi" (typo/accent)
    
    4. Otherwise → DIFFERENT ENTITIES
    
    This prevents false positives like:
    - "Parque Barigui" vs "Parque Bacacheri" (different names)
    - "Bar A #100" vs "Bar A #102" (different addresses)
    
    Args:
        poi1: First POI
        poi2: Second POI
        use_fuzzy_tiebreak: Use rapidfuzz for near-matches (> 0.95)
        
    Returns:
        True if same entity, False otherwise
    """
    # Priority 1: GERS ID (Overture official deduplication)
    if poi1.overture_id == poi2.overture_id:
        return True
    
    # Priority 2: Exact normalization key + address
    if poi1.normalization_key == poi2.normalization_key:
        return has_matching_address_anchor(poi1, poi2)
    
    # Priority 3: Fuzzy tiebreak (very high similarity only)
    if use_fuzzy_tiebreak and poi1.normalization_key and poi2.normalization_key:
        similarity = fuzz.ratio(poi1.normalization_key, poi2.normalization_key) / 100.0
        if similarity > 0.95:
            return has_matching_address_anchor(poi1, poi2)
    
    # Different entities
    return False


def get_search_radius() -> float:
    """
    Return fixed search radius for all categories.
    
    Rationale:
    - 100m is sufficient for address-level deduplication
    - Prevents false positives from overly large radius
    - Scales globally (works in dense urban and sparse rural)
    - Conservative approach: prefer false negatives over false positives
    
    Previous approach used 800m for parks, causing:
    - "Parque Barigui" merged with nearby "Parque Linear Barigui"
    - Different establishments incorrectly unified
    
    Returns:
        100.0 meters (fixed for all categories)
    """
    return 100.0


def deduplicate_pois_in_memory(
    pois_list: List[tuple],
    config: dict
) -> Tuple[List[tuple], Dict[str, str], Dict[str, POI]]:
    """
    Deduplicate POIs using entity resolution with address anchoring.
    
    Algorithm:
    1. Build spatial index (KDTree) for fast 100m radius queries
    2. For each POI:
       a. Generate normalization key
       b. Find nearby candidates (< 100m)
       c. Check entity matching (norm key + address)
       d. Build cluster of duplicates
    3. For each cluster:
       a. Elect winner (highest relevance_score)
       b. Map losers to winner
    4. Return winners + all mappings for place_sources
    
    Non-Destructive Architecture:
    - Preserves ALL POI data (winners + losers)
    - Returns complete mappings for SQL insert
    - Future hydrations recognize all IDs as "already processed"
    
    Args:
        pois_list: List of tuples from DuckDB query
        config: Curation configuration dict
        
    Returns:
        winners: List of unique POI tuples (master records)
        duplicate_mappings: Dict[loser_id → winner_id]
        all_pois_data: Dict[overture_id → POI] (preserve all data)
    """
    if not pois_list:
        return [], {}, {}
    
    # Parse POIs into structured format with normalization keys
    pois = []
    all_pois_data = {}
    
    for row in pois_list:
        # Calculate quality score
        quality_score = 0
        quality_score += row[POIColumn.SOURCE_MAGNITUDE] * 10 if row[POIColumn.SOURCE_MAGNITUDE] else 0
        quality_score += 50 if row[POIColumn.HAS_BRAND] else 0
        quality_score += int(row[POIColumn.CONFIDENCE] * 100) if row[POIColumn.CONFIDENCE] else 0
        
        # Get internal category
        overture_cat = row[POIColumn.OVERTURE_CATEGORY]
        category_map = config.get('categories', {}).get('mapping', {})
        internal_cat = category_map.get(overture_cat, overture_cat)
        
        # Generate normalization key
        name = row[POIColumn.NAME]
        norm_key = generate_normalization_key(name)
        
        # Extract house_number and postal_code
        house_number = row[POIColumn.HOUSE_NUMBER] or ""
        postal_code = row[POIColumn.POSTAL_CODE] or ""
        
        poi = POI(
            overture_id=row[POIColumn.OVERTURE_ID],
            name=name,
            lat=None,  # Extract from WKB below
            lng=None,
            category=internal_cat,
            house_number=house_number,
            postal_code=postal_code,
            relevance_score=quality_score,
            normalization_key=norm_key,
            row_data=row
        )
        
        # Extract lat/lng from WKB geometry
        if row[POIColumn.GEOM_WKB]:
            import struct
            wkb = row[POIColumn.GEOM_WKB]  # Already bytes from DuckDB
            # WKB Point format: [byte_order(1)][wkb_type(4)][X(8)][Y(8)]
            if len(wkb) >= 21:
                lng, lat = struct.unpack('<dd', wkb[5:21])
                poi.lat = lat
                poi.lng = lng
        
        pois.append(poi)
        all_pois_data[poi.overture_id] = poi
    
    # Build spatial index (KDTree)
    coords = np.array([(poi.lat, poi.lng) for poi in pois])
    tree = KDTree(coords)
    
    # Fixed radius for all categories
    radius_meters = get_search_radius()  # 100m
    radius_degrees = radius_meters / 111000  # ~0.0009 degrees
    
    processed = set()
    winners = []
    duplicate_mappings = {}  # loser_id → winner_id
    
    for idx, poi in enumerate(pois):
        if idx in processed:
            continue
        
        # Find nearby POIs within 100m
        nearby_indices = tree.query_ball_point([poi.lat, poi.lng], radius_degrees)
        
        # Build cluster of duplicates
        cluster = [idx]
        for nearby_idx in nearby_indices:
            if nearby_idx in processed or nearby_idx == idx:
                continue
            
            nearby_poi = pois[nearby_idx]
            
            # Check if same entity (normalization key + address)
            if are_same_entity(poi, nearby_poi, use_fuzzy_tiebreak=True):
                cluster.append(nearby_idx)
                processed.add(nearby_idx)
        
        # Elect winner from cluster (highest relevance_score)
        if len(cluster) == 1:
            # No duplicates, keep as-is
            winners.append(poi.row_data)
        else:
            # Multiple POIs in cluster, pick winner
            best_idx = max(cluster, key=lambda i: pois[i].relevance_score)
            winner_poi = pois[best_idx]
            winners.append(winner_poi.row_data)
            
            # Map all losers to winner
            for loser_idx in cluster:
                loser_poi = pois[loser_idx]
                if loser_idx != best_idx:
                    duplicate_mappings[loser_poi.overture_id] = winner_poi.overture_id
        
        processed.add(idx)
    
    print(f"🧹 Entity Resolution: {len(pois)} POIs → {len(winners)} unique ({len(pois) - len(winners)} duplicates removed)")
    
    return winners, duplicate_mappings, all_pois_data
