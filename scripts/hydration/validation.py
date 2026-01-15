"""
POI validation functions.
Includes category validation, taxonomy checks, and OSM filtering.
"""


def validate_category_name(name, category, original_category, config):
    """Validate consistency between category and name."""
    name_lower = name.lower()
    
    rules = config['taxonomy']['cross_validation_rules']
    
    # Check required_terms rules
    if category in rules and 'required_terms' in rules[category]:
        required_terms = rules[category]['required_terms']
        if not any(term in name_lower for term in required_terms):
            return False
    
    # Check forbidden_terms rules
    if category in rules and 'forbidden_terms' in rules[category]:
        forbidden_terms = rules[category]['forbidden_terms']
        if any(term in name_lower for term in forbidden_terms):
            return False
    
    return True


def check_taxonomy_hierarchy(category_tags, overture_category, alternate_categories, config):
    """Check if the category is valid within the taxonomy hierarchy."""
    # Get taxonomy config
    taxonomy_config = config.get('taxonomy', {})
    category_hierarchy = taxonomy_config.get('category_hierarchy', {})
    
    # Combine with alternates
    all_cats = [overture_category] + (alternate_categories or [])
    
    # Check if any category is in our whitelist
    for cat in all_cats:
        if cat in category_hierarchy:
            return True
    
    return False


def filter_osm_red_flags(category_tags, config):
    """Filter out POIs with problematic OSM tags."""
    if not category_tags:
        return True
    
    osm_config = config.get('taxonomy', {}).get('osm_red_flags', [])
    
    category_tags_lower = category_tags.lower()
    for red_flag in osm_config:
        if red_flag in category_tags_lower:
            return False
    
    return True
