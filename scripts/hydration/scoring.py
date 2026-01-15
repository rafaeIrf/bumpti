"""
POI relevance scoring system.
Calculates scores based on data quality, social presence, and authority signals.
"""


def calculate_scores(confidence, websites, socials, street=None, house_number=None, neighborhood=None,
                      source_magnitude=1, has_brand=False, is_iconic=False, config=None):
    """Calculate relevance score based on data magnitude and institutional authority.
    
    Returns: (relevance_score, bonus_flags) or None if rejected
    Uses values from config['categories']['scoring_modifiers']['base_scoring']
    """
    # Get scoring values from config (required)
    pts = config['categories']['scoring_modifiers']['base_scoring']
    
    has_social = False
    if socials:
        for social in socials:
            if isinstance(social, dict):
                platform = social.get('platform', '').lower()
                if platform in ['instagram', 'facebook']:
                    has_social = True
                    break
    
    has_website = bool(websites and isinstance(websites, (list, tuple)) and len(websites) > 0)
    has_online = has_website or has_social
    
    if not has_online and confidence < 0.9:
        return None
    
    # === RELEVANCE SCORE (all signals combined) ===
    relevance = pts['base']
    
    # Bonus tracking for diagnostics
    bonus_flags = {
        'magnitude_bonus': 0,
        'brand_bonus': False,
        'dual_presence_bonus': False,
        'iconic_bonus': False
    }
    
    # ICONIC BOOST: AI-identified iconic venues
    if is_iconic:
        relevance += 100  # Guarantees cap at 100
        bonus_flags['iconic_bonus'] = True
    
    # SOCIAL SIGNALS
    if has_website:
        relevance += pts['website']
    
    if has_social:
        relevance += pts['social']
    
    if confidence >= 0.9:
        relevance += pts['high_confidence']
    
    # ADDRESS COMPLETENESS
    if house_number and str(house_number).strip():
        relevance += pts['house_number']
    
    if neighborhood and str(neighborhood).strip():
        relevance += pts['neighborhood']
    
    if street and str(street).strip():
        relevance += pts['street']
    
    # DATA MAGNITUDE BONUS: Multiple data sources = higher consensus
    if source_magnitude >= 3:
        relevance += pts['source_magnitude_3plus']
        bonus_flags['magnitude_bonus'] = pts['source_magnitude_3plus']
    elif source_magnitude == 2:
        relevance += pts['source_magnitude_2']
        bonus_flags['magnitude_bonus'] = pts['source_magnitude_2']
    
    # INSTITUTIONAL AUTHORITY: Has brand
    if has_brand:
        relevance += pts['brand_authority']
        bonus_flags['brand_bonus'] = True
    
    # DUAL PRESENCE BONUS: Has BOTH website AND social media
    if has_website and has_social:
        relevance += pts['dual_presence']
        bonus_flags['dual_presence_bonus'] = True
    
    return (relevance, bonus_flags)


def apply_scoring_modifiers(relevance_score, internal_category, overture_category, config):
    """Apply taxonomic penalties and boosts to relevance score.
    
    Returns: (modified_score, modifier_applied)
    - Penalties: fast_food 0.25x, gas_station 0.15x, etc
    - Boosts: stadium 2.0x, university 1.8x, etc
    """
    modifiers = config.get('categories', {}).get('scoring_modifiers', {})
    if not modifiers:
        return (relevance_score, 1.0)
    
    penalties = modifiers.get('penalties', {})
    boosts = modifiers.get('boosts', {})
    
    modifier = 1.0
    
    # Check PRIMARY TAXONOMY penalties
    taxonomy_primary = penalties.get('taxonomy_primary', {})
    overture_lower = overture_category.lower() if overture_category else ''
    if overture_lower in taxonomy_primary:
        modifier = min(modifier, taxonomy_primary[overture_lower])
    
    # Check HIERARCHY KEYWORD penalties
    taxonomy_keywords = penalties.get('taxonomy_hierarchy_keywords', {})
    for keyword, penalty in taxonomy_keywords.items():
        if keyword in overture_lower:
            modifier = min(modifier, penalty)
    
    # Check INTERNAL CATEGORY boosts (only if no penalty applied)
    if modifier >= 1.0:
        internal_boosts = boosts.get('internal_category', {})
        internal_lower = internal_category.lower() if internal_category else ''
        if internal_lower in internal_boosts:
            modifier = internal_boosts[internal_lower]
    
    modified_score = int(relevance_score * modifier)
    return (modified_score, modifier)


def calculate_taxonomy_weight(category, original_category, config):
    """Calculate additional weight based on taxonomy hierarchy."""
    category_lower = category.lower() if category else ''
    original_lower = original_category.lower() if original_category else ''
    combined = f"{category_lower} {original_lower}"
    
    weights = config['taxonomy']['taxonomy_weights']
    
    for weight_type, weight_data in weights.items():
        for cat in weight_data['categories']:
            if cat in combined:
                return weight_data['bonus']
    
    return 0
