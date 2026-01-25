"""
Hydration package for POI data processing.
Modular structure for maintainability and testability.
"""

# Utils
from .utils import load_config, build_category_map, sanitize_name

# Validation
from .validation import (
    validate_category_name,
    check_taxonomy_hierarchy,
    filter_osm_red_flags
)

# Scoring
from .scoring import (
    calculate_scores,
    apply_scoring_modifiers,
    calculate_taxonomy_weight
)

# AI Matcher
from .ai_matcher import (
    generate_hotlist,
    get_cached_hotlist,
    save_hotlist_to_cache,
    find_candidates_for_iconic,
    ai_validate_matches_batch,
    ai_match_iconic_venues
)

# Database
from .database import (
    upsert_city_to_registry,
    fetch_city_from_registry
)

# Geofencing
from .geofencing import (
    fetch_city_polygons,
    compute_poi_boundary,
    export_geojson_by_category,
    AREA_CATEGORIES,
    POINT_CATEGORIES,
    SAFETY_MARGIN_METERS
)

__all__ = [
    # Utils
    'load_config',
    'build_category_map',
    'sanitize_name',
    # Validation
    'validate_category_name',
    'check_taxonomy_hierarchy',
    'filter_osm_red_flags',
    # Scoring
    'calculate_scores',
    'apply_scoring_modifiers',
    'calculate_taxonomy_weight',
    # AI Matcher
    'generate_hotlist',
    'get_cached_hotlist',
    'save_hotlist_to_cache',
    'find_candidates_for_iconic',
    'ai_validate_matches_batch',
    'ai_match_iconic_venues',
    # Database
    'upsert_city_to_registry',
    'fetch_city_from_registry',
    # Geofencing
    'fetch_city_polygons',
    'compute_poi_boundary',
    'export_geojson_by_category',
    'AREA_CATEGORIES',
    'POINT_CATEGORIES',
    'SAFETY_MARGIN_METERS',
]

