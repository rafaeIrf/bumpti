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
        
        prompt = f"""You are NOT generating a list.
You are performing FACTUAL RECOGNITION.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE RULE (MOST IMPORTANT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Only include venues that you STRONGLY RECOGNIZE as real, named, established places
that you have seen referenced multiple times in real-world contexts.

If a name is created by a common pattern (e.g. "Bar do X", "Café do Y"):
→ DO NOT include it unless it is a widely famous, unmistakable venue.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GEOGRAPHIC BOUNDARY (HARD)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Only include venues that are physically located in {location}.
Do NOT include nearby cities or metropolitan regions.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANTI-FABRICATION RULE (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You are FORBIDDEN from:
- inventing plausible local names
- completing lists
- using cultural naming patterns
- guessing small or neighborhood places
- using generic names or personal names

If you feel tempted to "fill the list":
STOP and return fewer items.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BRAND & NAME RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Brands are listed ONCE
- No branches, no units
- No "Original", "Centro", "Shopping", "Batel", etc.
- No abbreviations unless they are the official name

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CATEGORY RULE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Each venue appears in ONE category only.
If unsure about the category → EXCLUDE.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TARGET COUNTS (MAXIMUM, NOT GOALS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
These are upper bounds, NOT expectations:

- bar: max 30
- nightclub: max 20
- restaurant: max 30
- club: max 20
- stadium: max 15
- park: max 15
- cafe: max 20
- gym: max 20
- university: max 15

Returning 5–10 items is PERFECTLY ACCEPTABLE.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL SELF-CHECK (MANDATORY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Before answering, ask yourself for EACH venue:
“Would I confidently bet money this place exists with this exact name?”

If not → REMOVE IT.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT (STRICT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Return ONLY valid JSON.
No comments. No explanations.

{{
  "bar": [],
  "nightclub": [],
  "restaurant": [],
  "club": [],
  "stadium": [],
  "park": [],
  "cafe": [],
  "gym": [],
  "university": []
}}
"""

        response = client.chat.completions.create(
            model="gpt-4.1",  # Latest model as of Jan 2026
            messages=[
                {"role": "system", "content": f"You are a knowledgeable local expert for {location}. Your goal is to provide comprehensive lists of REAL venues. Start with famous landmarks, then include well-established places, then local favorites. Aim for target quantities - it's expected to list 20-30 bars and restaurants if you know the city well. Only skip venues if you're uncertain they exist."},
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
        """, (city_id, json.dumps(hotlist), venue_count, 'gpt-4.1', 0.1))
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
    
    # Enhanced deduplication of hotlist items
    deduplicated_hotlist = {}
    for category, venues in hotlist.items():
        if isinstance(venues, list):
            seen = set()
            deduplicated = []
            for venue in venues:
                # Normalize for dedup: lowercase, remove location suffixes and prefixes
                base_name = venue.lower().strip()
                
                # Remove category prefixes for comparison
                for prefix in ['restaurante ', 'bar ', 'café ', 'clube ']:
                    if base_name.startswith(prefix):
                        base_name = base_name[len(prefix):].strip()
                
                # Remove common location patterns
                for pattern in [' batel', ' água verde', ' centro', ' shopping', ' do shopping', ' do parque', ' do museu']:
                    if base_name.endswith(pattern):
                        base_name = base_name.replace(pattern, '').strip()
                
                if base_name not in seen:
                    seen.add(base_name)
                    deduplicated.append(venue)
                else:
                    print(f"   ⚠️ Deduped: '{venue}' (similar to existing in '{category}')")
            
            deduplicated_hotlist[category] = deduplicated
        else:
            deduplicated_hotlist[category] = venues # Keep non-list items as is
    
    # Use the deduplicated hotlist for further processing
    hotlist = deduplicated_hotlist

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
