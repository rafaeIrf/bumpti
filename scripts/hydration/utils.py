"""
Utility functions for POI hydration.
Includes configuration loading, name sanitization, and category mapping.
"""
import json


def load_config(config_path):
    """Load configuration from JSON file."""
    with open(config_path, 'r') as f:
        return json.load(f)


def build_category_map(config):
    """Build mapping from Overture categories to internal categories."""
    category_map = {}
    for internal_cat, cat_config in config['categories']['mappings'].items():
        for overture_cat in cat_config['overture_categories']:
            category_map[overture_cat] = internal_cat
    return category_map


def sanitize_name(name, config):
    """Remove company suffixes and validate against blacklist."""
    if not name:
        return None
    
    name_lower = name.lower()
    for term in config['names']['blacklist']:
        if term in name_lower:
            return None
    
    cleaned = name
    for suffix in config['names']['suffixes_to_remove']:
        if cleaned.endswith(suffix):
            cleaned = cleaned[:-len(suffix)].strip()
    
    return cleaned
