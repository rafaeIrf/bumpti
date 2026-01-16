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


def parse_street_address(freeform):
    """
    Extract street name and house number from freeform address.
    
    Handles multiple international address formats:
    - English: "123 Main Street" → ("Main Street", "123")
    - Brazilian (comma): "Rua XV de Novembro, 123" → ("Rua XV de Novembro", "123")
    - Brazilian (no comma): "Avenida Paulista 1000" → ("Avenida Paulista", "1000")
    - No number: "Main St" → ("Main St", None)
    
    Args:
        freeform: Full address string from Overture Maps
        
    Returns:
        Tuple of (street_name, house_number)
    """
    import re
    
    if not freeform:
        return (None, None)
    
    freeform = freeform.strip()
    
    # Pattern 1: Number at start (English: "123 Main Street")
    match = re.match(r'^(\d+[\w/-]*)\s+(.+)$', freeform)
    if match:
        return (match.group(2), match.group(1))
    
    # Pattern 2: Number after comma (Brazilian: "Rua Nome, 123")
    match = re.match(r'^(.+?),\s*(\d+[\w/-]*)$', freeform)
    if match:
        return (match.group(1), match.group(2))
    
    # Pattern 3: Number at end (no comma: "Avenida Paulista 1000")
    match = re.match(r'^(.+?)\s+(\d+[\w/-]*)$', freeform)
    if match:
        street, number = match.group(1), match.group(2)
        # Only extract if clearly numeric (avoid "XV de Novembro" → "XV de", "Novembro")
        if number.isdigit() or re.match(r'^\d+[A-Za-z]?$', number):
            return (street, number)
    
    # No number found - return address as-is
    return (freeform, None)

