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
        
        prompt = f"""Você é um guia local expert em {city_name}. Sua tarefa é listar os estabelecimentos mais FAMOSOS, BADALADOS e ICÔNICOS.

REGRAS DE OURO (OBRIGATÓRIAS):
❌ PROIBIDO inventar nomes ou usar nomes genéricos ("Bar do Zé", "Academia Fit", "Club X", "Restaurante Popular", etc.)
❌ Se você não souber lugares REAIS e FAMOSOS, retorne APENAS os que você tem certeza absoluta que existem.
✅ QUALIDADE > QUANTIDADE. Prefiro 50 lugares REAIS do que 200 inventados.
✅ Foque em nomes que teriam uma conta grande no Instagram ou Google Maps com muitas avaliações.
✅ Use o NOME OFICIAL completo do estabelecimento.

EXEMPLOS DE NOMES REAIS (Curitiba):
- Nightlife: "Taj Pharmacy", "+55", "Wit Bar", "Shed", "James Bar", "Hottel 418", "Sheridan's Irish Pub"
- Gastronomy: "Madalosso", "Madero Prime", "Terrazza 40", "Bar do Alemão", "Coco Bambu", "Durski"
- Parks: "Parque Barigui", "Bosque Alemão", "Jardim Botânico", "Parque TânguaEstadiums: "Çoço Couto Pereira", "Arena da Baixada", "Estádio Durival Britto"

CATEGORIAS (retorne APENAS os que você conhece):
- bar: bares famosos e badalados
- nightclub: baladas e casas noturnas icônicas
- park: parques conhecidos e frequentados
- stadium: estádios de futebol principais
- university: universidades reconhecidas
- gym: academias de grande porte ou franquias conhecidas
- club: clubes sociais tradicionais
- restaurant: restaurantes famosos e renomados
- shopping: shoppings principais

Retorne APENAS um JSON:
{{
  "bar": ["Nome Real 1", "Nome Real 2", ...],
  "nightclub": [...],
  "park": [...],
  "stadium": [...],
  "university": [...],
  "gym": [...],
  "club": [...],
  "restaurant": [...],
  "shopping": [...]
}}

LEMBRETE FINAL: Se tiver dúvida sobre um nome, NÃO INCLUA. Só lugares que realmente existem e são famosos."""

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an expert local guide who ONLY provides real, verified venue names. Never invent or use generic names."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.5
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
        """, (city_id, json.dumps(hotlist), venue_count, 'gpt-4o', 0.2))
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
        all_pois: List of all POIs from Overture [(name, internal_id), ...]
        category: Category to match
        max_candidates: Maximum candidates to return
        min_similarity: Minimum token_set_ratio score (0-100)
    
    Returns: List of (poi_name, poi_id, similarity_score)
    """
    candidates = []
    iconic_normalized = iconic_name.lower().strip()
    
    for poi_name, poi_id in all_pois:
        poi_normalized = poi_name.lower().strip()
        
        # Calculate similarity
        similarity = fuzz.token_set_ratio(iconic_normalized, poi_normalized)
        
        if similarity >= min_similarity:
            candidates.append((poi_name, poi_id, similarity))
    
    # Sort by similarity and take top N
    candidates.sort(key=lambda x: x[2], reverse=True)
    return candidates[:max_candidates]


def ai_validate_matches_batch(validation_batch, api_key):
    """STAGE 2: Use gpt-4o-mini as semantic judge to validate matches in batch.
    
    Args:
        validation_batch: List of {"iconic_name": str, "candidates": [{"id": int, "name": str}]}
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
3. Matches INVÁLIDOS: 'Bar do Zé' ≠ 'Bar do Pedro', 'Academia Fit' ≠ 'Academia Smart Fit'
4. Se NENHUM candidato for um match óbvio, retorne null para aquele local.

LOCAIS E CANDIDATOS:
{batch_data}

Retorne um JSON com o formato:
{{
  "matches": {{
    "nome_do_local_iconico": candidate_id_ou_null,
    ...
  }}
}}

Retorne APENAS o JSON, sem texto adicional."""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a precise semantic validator. Return only valid JSON."},
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
                # Prepare for AI validation
                candidate_list = []
                for poi_name, poi_id, similarity in candidates:
                    candidate_list.append({"id": poi_id, "name": poi_name})
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
            if matched_id and matched_id in poi_id_to_name:
                matched_pois[matched_id] = iconic_name
                print(f"   ✅ '{iconic_name}' → '{poi_id_to_name[matched_id]}'")
    
    print(f"✨ AI Matcher: {len(matched_pois)} iconic venues matched")
    return matched_pois
