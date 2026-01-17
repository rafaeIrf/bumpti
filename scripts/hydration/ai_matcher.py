"""
AI-powered iconic venue matching system.
Generates hotlist with OpenAI, caches in DB, and validates matches semantically.
"""
import os
import json
from openai import OpenAI
from rapidfuzz import fuzz


def generate_hotlist(city_name, state=None, country_code=None):
    """Generate categorized hotlist of iconic venues using OpenAI gpt-4o.
    
    Args:
        city_name: Name of the city
        state: State/region code (e.g., 'SP', 'PR') for disambiguation
        country_code: Country code (e.g., 'BR') for additional context
    
    Returns: dict with categories as keys (e.g., {"bar": [...], "nightclub": [...]}) or empty dict if API fails
    """
    # Build location string with state and country for disambiguation
    location = city_name
    if state:
        location = f"{city_name}, {state}"
    if country_code:
        location = f"{location}, {country_code}"
    
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        print("⚠️  OPENAI_API_KEY not set - skipping AI hotlist generation")
        return {}
    
    try:
        client = OpenAI(api_key=api_key)
        
        prompt = f"""You are a local expert in {location} with deep knowledge of real establishments in the city.

TASK: List REAL and VERIFIABLE venues in {location}, prioritizing from most famous to moderately well-known.

📊 TARGETS PER CATEGORY (quality over quantity):
- bar: up to 30 REAL venues
- nightclub: up to 20 REAL venues
- restaurant: up to 30 REAL venues
- club: up to 15 REAL venues
- stadium: up to 15 REAL venues
- park: up to 15 REAL venues
- cafe: up to 15 REAL venues
- university: up to 15 REAL venues

🎯 SELECTION STRATEGY (priority order):
1. **Tier 1 - Iconic** (30% of list): Extremely famous places, city landmarks
2. **Tier 2 - Popular** (40% of list): Well-known and frequently visited establishments
3. **Tier 3 - Known** (30% of list): Legitimate and established places, even if less famous

✅ MANDATORY RULES:
1. **ONLY return venues you are CERTAIN exist**
2. **Use complete official names** - e.g., "Bar do Alemão", not "Alemão"
3. **No permanently closed venues**
4. **Diversify geographically** when possible
5. **For small cities** - include smaller but legitimate establishments

📝 GOOD RESPONSE EXAMPLES:
bar: ["Bar do Alemão", "Boteco São Jorge", "Mercearía Dona Rosa", ...]
cafe: ["Café do Ponto", "Padaria Bella Vista", "Cafeteria Central", ...]

❌ BAD RESPONSE EXAMPLES (NEVER DO THIS):
bar: []  ← Empty arrays
bar: ["Bar 1", "Bar 2"]  ← Generic names
bar: ["Club 100", "Club 101", "Club 102"]  ← Invented sequential numbers
nightclub: ["Vibe Club", "Paradise Club"]  ← Generic English names
bar: ["Bar do Zito", "Bar do Zito II", "Bar do Zito III"]  ← Invented variations

🔄 IF YOU DON'T KNOW ENOUGH VENUES:
- Include smaller but REAL establishments from the city
- For small cities, list ALL legitimate establishments in the category
- Better to return fewer real venues than invent fake ones
- It's OK to have some categories with fewer items

RETURN ONLY VALID JSON in this format:
{{
  "bar": ["Real Specific Name 1", "Real Specific Name 2", ...],
  "nightclub": [...],
  "restaurant": [...],
  "club": [...],
  "stadium": [...],
  "park": [...],
  "cafe": [...],
  "university": [...]
}}"""

        response = client.chat.completions.create(
            model="gpt-4o",  # Changed from gpt-5.2 (doesn't exist) to gpt-4o
            messages=[
                {"role": "system", "content": f"You are a strict quality-focused local expert for {location}. CRITICAL: Only return venues you are CERTAIN exist. It's better to return 5 real places than 30 fake ones. NEVER invent sequential names (Club 100, 101...) or generic variations (Bar X, Bar X II...). If uncertain, return FEWER venues."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.1  # Very low - prioritize factual recall, not creativity
        )
        
        result = json.loads(response.choices[0].message.content)
        
        # Count total venues
        total_venues = sum(len(venues) for venues in result.values())
        print(f"🤖 AI Hotlist Generated: {total_venues} iconic venues across {len(result)} categories for {location}")
        
        return result
        
    except Exception as e:
        print(f"❌ OpenAI API Error: {str(e)}")
        return {}


def get_cached_hotlist(city_id, pg_conn):
    """Retrieve cached hotlist from database if available and recent."""
    try:
        cur = pg_conn.cursor()
        cur.execute("""
            SELECT hotlist, generated_at, venue_count
            FROM ai_city_hotlist
            WHERE city_id = %s AND generated_at > NOW() - INTERVAL '30 days'
        """, (city_id,))
        row = cur.fetchone()
        cur.close()
        if row:
            from datetime import datetime, timezone
            hotlist, generated_at, venue_count = row
            age_days = (datetime.now(timezone.utc) - generated_at).days
            print(f"📦 Using cached hotlist ({venue_count} venues, {age_days} days old)")
            return hotlist
        return None
    except Exception as e:
        print(f"⚠️  Cache retrieval error: {str(e)}")
        return None


def save_hotlist_to_cache(city_id, hotlist, pg_conn):
    """Save hotlist to database cache."""
    try:
        cur = pg_conn.cursor()
        venue_count = sum(len(venues) for venues in hotlist.values())
        cur.execute("""
            INSERT INTO ai_city_hotlist (city_id, hotlist, venue_count, model_version, temperature)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (city_id) 
            DO UPDATE SET hotlist = EXCLUDED.hotlist, venue_count = EXCLUDED.venue_count,
                generated_at = NOW(), updated_at = NOW()
        """, (city_id, json.dumps(hotlist), venue_count, 'gpt-5.2', 0.2))
        pg_conn.commit()
        cur.close()
        print(f"💾 Hotlist cached to database ({venue_count} venues)")
    except Exception as e:
        print(f"⚠️  Cache save error: {str(e)}")
        pg_conn.rollback()


def find_candidates_for_iconic(iconic_name, all_pois, category, max_candidates=5, min_similarity=70):
    """STAGE 1: Pre-filter POIs using fuzzy matching to find candidates.
    
    Args:
        iconic_name: Name from AI hotlist
        all_pois: List of all POIs from Overture [(name, internal_id, neighborhood), ...]
        category: Category to match
        max_candidates: Maximum candidates to return
        min_similarity: Minimum token_set_ratio score (0-100)
    
    Returns: List of (poi_name, poi_id, neighborhood, similarity_score)
    """
    candidates = []
    iconic_normalized = iconic_name.lower().strip()
    
    for poi_tuple in all_pois:
        poi_name = poi_tuple[0]
        poi_id = poi_tuple[1]
        poi_neighborhood = poi_tuple[2] if len(poi_tuple) > 2 else None
        
        poi_normalized = poi_name.lower().strip()
        
        # Calculate similarity
        similarity = fuzz.token_set_ratio(iconic_normalized, poi_normalized)
        
        if similarity >= min_similarity:
            candidates.append((poi_name, poi_id, poi_neighborhood, similarity))
    
    # Sort by similarity and take top N
    candidates.sort(key=lambda x: x[3], reverse=True)
    return candidates[:max_candidates]


def ai_validate_matches_batch(validation_batch, api_key):
    """STAGE 2: Use gpt-4o-mini as semantic judge to validate matches in batch.
    
    Args:
        validation_batch: List of {"iconic_name": str, "candidates": [{"id": int, "name": str, "neighborhood": str}]}
        api_key: OpenAI API key
    
    Returns: Dict mapping iconic_name -> matched_poi_id (or None)
    """
    if not validation_batch or not api_key:
        return {}
    
    try:
        client = OpenAI(api_key=api_key)
        
        # Build batch prompt
        batch_data = json.dumps(validation_batch, ensure_ascii=False, indent=2)
        
        prompt = f"""You are a semantic validator for venues. Your task is to identify correct matches between iconic venues and real candidates.

RULES:
1. A match is valid when the candidate clearly refers to the SAME establishment as the iconic venue.
2. Acceptable variations: '+55' = '+55 Bar', 'Parque Barigui' = 'Parque Ecológico Barigui'
3. Accept suffix variations: 'Shopping X', 'Unit Y', etc.
4. If NO candidate is an obvious match, return null.

VENUES AND CANDIDATES:
{batch_data}

MANDATORY RETURN FORMAT:
{{
  "matches": {{
    "iconic_venue_name": 123,
    "another_venue": 456,
    "no_match": null
  }}
}}

IMPORTANT: 
- Values must be INTEGER NUMBERS (candidate id), NOT arrays
- Use null (not empty list) when there's no match
- Return ONLY JSON, no additional text."""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a precise semantic validator. Return only valid JSON. Match venues by name similarity."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.1
        )
        
        result = json.loads(response.choices[0].message.content)
        return result.get('matches', {})
        
    except Exception as e:
        print(f"⚠️  AI validation error: {str(e)}")
        return {}


def ai_match_iconic_venues(hotlist, all_pois_by_category):
    """Complete AI matcher pipeline: pre-filter + batch validation.
    
    Args:
        hotlist: Dict of {category: [iconic_names]}
        all_pois_by_category: Dict of {category: [(name, internal_id)]}
    
    Returns: Dict mapping poi_id -> iconic_name for matched venues
    """
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        print("⚠️  OPENAI_API_KEY not set - skipping AI matching")
        return {}
    
    matched_pois = {}  # poi_id -> iconic_name
    validation_queue = []
    poi_id_to_name = {}  # Track poi_id -> poi_name for later lookup
    
    # STAGE 1: Build candidates for all iconic venues
    for category, iconic_names in hotlist.items():
        all_pois = all_pois_by_category.get(category, [])
        if not all_pois:
            continue
        
        for iconic_name in iconic_names:
            candidates = find_candidates_for_iconic(iconic_name, all_pois, category)
            
            if candidates:
                # Prepare for AI validation - send only ID and name
                candidate_list = []
                for poi_name, poi_id, poi_neighborhood, similarity in candidates:
                    candidate_list.append({
                        "id": poi_id,
                        "name": poi_name
                    })
                    poi_id_to_name[poi_id] = poi_name
                
                validation_queue.append({
                    "iconic_name": iconic_name,
                    "candidates": candidate_list
                })
    
    # STAGE 2: Batch validate in chunks of 20
    batch_size = 20
    for i in range(0, len(validation_queue), batch_size):
        batch = validation_queue[i:i + batch_size]
        
        print(f"🤖 AI validating batch {i//batch_size + 1} ({len(batch)} venues)...")
        
        matches = ai_validate_matches_batch(batch, api_key)
        
        # Process results
        for iconic_name, matched_id in matches.items():
            # OpenAI sometimes returns list instead of single ID - handle both
            if isinstance(matched_id, list):
                matched_id = matched_id[0] if matched_id else None
            
            if matched_id and matched_id in poi_id_to_name:
                matched_pois[matched_id] = iconic_name
                print(f"   ✅ '{iconic_name}' → '{poi_id_to_name[matched_id]}'")
    
    print(f"✨ AI Matcher: {len(matched_pois)} iconic venues matched")
    return matched_pois
