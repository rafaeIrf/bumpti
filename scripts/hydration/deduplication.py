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
    Remove exact duplicates based on normalized name + street + house_number.
    
    Algorithm:
    1. For each POI, create dedup key: (norm_name, norm_street, norm_house_number)
    2. Group POIs by dedup key
    3. For each group:
       a. Calculate completeness score
       b. Select winner (highest score)
       c. Map losers to winner
    
    Args:
        pois_list: List of tuples from DuckDB query
        config: Curation configuration dict
        
    Returns:
        winners: List of unique POI tuples (no exact duplicates)
        duplicate_mappings: Dict[loser_id → winner_id]
        all_pois_data: Dict[overture_id → POI tuple] (preserve all data)
    """
    if not pois_list:
        return [], {}, {}
    
    # Group POIs by dedup key
    dedup_groups = {}  # key → [poi_idx, ...]
    all_pois_data = {}  # overture_id → row
    
    for idx, row in enumerate(pois_list):
        overture_id = row[POIColumn.OVERTURE_ID]
        all_pois_data[overture_id] = row
        
        # Create dedup key (normalized name + street + house_number)
        norm_name = normalize_text(row[POIColumn.NAME])
        norm_street = normalize_text(row[POIColumn.STREET])
        norm_house_number = normalize_text(row[POIColumn.HOUSE_NUMBER])
        
        dedup_key = (norm_name, norm_street, norm_house_number)
        
        if dedup_key not in dedup_groups:
            dedup_groups[dedup_key] = []
        dedup_groups[dedup_key].append(idx)
    
    # Select winners from each group
    winners = []
    duplicate_mappings = {}
    
    for dedup_key, poi_indices in dedup_groups.items():
        if len(poi_indices) == 1:
            # No duplicates, keep as-is
            winners.append(pois_list[poi_indices[0]])
        else:
            # Multiple POIs with same key, select winner
            # Calculate completeness scores
            scores = []
            for idx in poi_indices:
                row = pois_list[idx]
                completeness = calculate_completeness_score(row)
                scores.append((completeness, idx))
            
            # Sort by score (descending), pick highest
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
    
    num_removed = len(pois_list) - len(winners)
    print(f"🧹 Simple Dedup: {len(pois_list)} POIs → {len(winners)} unique ({num_removed} exact duplicates removed)")
    
    return winners, duplicate_mappings, all_pois_data
