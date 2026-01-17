"""
AI-powered iconic venue matching system.
Generates hotlist with OpenAI, caches in DB, and validates matches semantically.
"""
import os
import json
from openai import OpenAI
from rapidfuzz import fuzz


def generate_hotlist(city_name):
    """Generate categorized hotlist of iconic venues using OpenAI gpt-4o.
    
    Returns: dict with categories as keys (e.g., {"bar": [...], "nightclub": [...]}) or empty dict if API fails
    """
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        print("⚠️  OPENAI_API_KEY not set - skipping AI hotlist generation")
        return {}
    
    try:
        client = OpenAI(api_key=api_key)
        
        prompt = f"""Você é um especialista local em {city_name} com conhecimento profundo sobre estabelecimentos reais da cidade.

TAREFA: Listar locais REAIS e VERIFICÁVEIS de {city_name}, priorizando dos mais famosos aos moderadamente conhecidos.

📊 DISTRIBUIÇÃO OBRIGATÓRIA (mínimos por categoria):
- bar: 30 locais mínimo
- nightclub: 20 locais mínimo
- restaurant: 30 locais mínimo
- club: 15 locais mínimo
- stadium: 15 locais mínimo
- park: 15 locais mínimo
- cafe: 15 locais mínimo
- university: 15 locais mínimo

🎯 ESTRATÉGIA DE SELEÇÃO (ordem de prioridade):
1. **Tier 1 - Icônicos** (30% da lista): Lugares extremamente famosos, marcos da cidade
2. **Tier 2 - Populares** (40% da lista): Estabelecimentos bastante conhecidos e frequentados
3. **Tier 3 - Conhecidos** (30% da lista): Lugares legítimos e estabelecidos, mesmo que menos famosos

✅ REGRAS OBRIGATÓRIAS:
1. **NUNCA retorne arrays vazios** - se não souber 30 bares icônicos, inclua os conhecidos
2. **Use nomes oficiais completos** - ex: "Boteco da Esquina", não "Esquina"
3. **Apenas lugares REAIS** - que existem ou existiram recentemente em {city_name}
4. **Sem lugares fechados** - não inclua estabelecimentos permanentemente fechados
5. **Diversifique geograficamente** - cubra diferentes bairros quando possível
6. **Para cidades pequenas** - inclua estabelecimentos menores mas legítimos

📝 EXEMPLOS DE BOA RESPOSTA:
bar: ["Bar do Alemão", "Boteco São Jorge", "Bar e Mercearia Dona Rosa", ...]
cafe: ["Café do Ponto", "Padaria Bella Vista", "Cafeteria Central", ...]

❌ EXEMPLOS DE RESPOSTA RUIM:
bar: []  ← NUNCA FAÇA ISSO
bar: ["Bar 1", "Bar 2"]  ← Nomes genéricos não aceitáveis

🔄 SE VOCÊ NÃO CONHECER LUGARES SUFICIENTES:
- Preencha com estabelecimentos menores mas reais da cidade
- Para cidades pequenas, liste TODOS os estabelecimentos legítimos da categoria
- Prefira incluir um local menos famoso (mas real) do que deixar vazio

RETORNE APENAS JSON VÁLIDO no formato:
{{
  "bar": ["Nome Real 1", "Nome Real 2", ...],
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
                {"role": "system", "content": f"You are a comprehensive local expert for {city_name}. You MUST provide AT LEAST the minimum number of real venues for each category. NEVER return empty arrays. If you don't know enough famous places, include legitimate smaller establishments. Real places only - no generic or invented names."},
                {"role": "user", "content": prompt}
            ],
            response_format={{"type": "json_object"}},
            temperature=0.3  # Slightly higher for more creativity in smaller cities
        )
        
        result = json.loads(response.choices[0].message.content)
        
        # Count total venues
        total_venues = sum(len(venues) for venues in result.values())
        print(f"🤖 AI Hotlist Generated: {total_venues} iconic venues across {len(result)} categories for {city_name}")
        
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
        
        prompt = f"""Você é um validador semântico de locais. Sua tarefa é identificar matches corretos entre locais icônicos e candidatos reais.

REGRAS:
1. Um match é válido quando o candidato claramente se refere ao MESMO estabelecimento que o local icônico.
2. Variações aceitáveis: '+55' = '+55 Bar', 'Parque Barigui' = 'Parque Ecológico Barigui'
3. Aceite variações de sufixos: 'Shopping X', 'Unidade Y', etc.
4. Se NENHUM candidato for um match óbvio, retorne null.

LOCAIS E CANDIDATOS:
{batch_data}

FORMATO DE RETORNO OBRIGATÓRIO:
{{
  "matches": {{
    "nome_do_local_iconico": 123,
    "outro_local": 456,
    "sem_match": null
  }}
}}

IMPORTANTE: 
- Os valores devem ser NÚMEROS INTEIROS (candidate id), NÃO arrays
- Use null (não lista vazia) quando não houver match
- Retorne APENAS o JSON, sem texto adicional."""

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
