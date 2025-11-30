CREATE OR REPLACE FUNCTION handle_like_for_match()
RETURNS trigger AS $$
DECLARE
  other_place  text;
  match_place  text;
  new_match_id uuid;
BEGIN
  -- Só processa likes
  IF NEW.action <> 'like' THEN
    RETURN NEW;
  END IF;

  -- Buscar o like recíproco (do outro usuário)
  SELECT ui.place_id
  INTO other_place
  FROM user_interactions ui
  WHERE 
    ui.action = 'like'
    AND ui.from_user_id = NEW.to_user_id
    AND ui.to_user_id   = NEW.from_user_id
  ORDER BY ui.created_at DESC
  LIMIT 1;

  -- Se não existe like recíproco, não gera match
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Determinar o place_id do match
  match_place := COALESCE(NEW.place_id, other_place);

  -- Criar ou atualizar o match
  INSERT INTO user_matches (user_a, user_b, status, matched_at, place_id)
  VALUES (
    LEAST(NEW.from_user_id, NEW.to_user_id),
    GREATEST(NEW.from_user_id, NEW.to_user_id),
    'active',
    NOW(),
    match_place
  )
  ON CONFLICT (user_a, user_b)
  DO UPDATE SET
    status     = 'active',
    matched_at = NOW(),
    place_id   = EXCLUDED.place_id
  RETURNING id INTO new_match_id;

  -- Criar ou atualizar chat (sem ambiguidade!)
  INSERT INTO chats (match_id, place_id)
  VALUES (new_match_id, match_place)
  ON CONFLICT (match_id)
  DO UPDATE SET
    place_id = EXCLUDED.place_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
