-- =============================================================================
-- Migration: Fix Enter Place Validation Logic
-- =============================================================================
-- Based on: 20260125170000_add_boundary_geofencing.sql
-- Changes:
-- 1. Update presence expiration: 30 minutes → 1 hour for ALL types
-- 2. Add boundary validation for physical presence on refresh
-- 3. Check-in+ active: Allow entry WITHOUT renewing time
-- 4. Check-in+ expired: Require boundary validation to renew
-- =============================================================================

CREATE OR REPLACE FUNCTION enter_place(
  p_user_id uuid,
  p_place_id uuid,
  p_user_lat float DEFAULT NULL,
  p_user_lng float DEFAULT NULL,
  p_is_checkin_plus boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inside_boundary boolean := false;
  v_existing_presence record;
  v_new_presence record;
  v_entry_type text;
  v_new_expires_at timestamptz;
  v_remaining_credits int;
  v_result jsonb;
BEGIN
  -- 1. Check boundary intersection (if coordinates provided)
  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN
    SELECT ST_Intersects(
      p.boundary,
      ST_SetSRID(ST_MakePoint(p_user_lng, p_user_lat), 4326)
    ) INTO v_inside_boundary
    FROM places p
    WHERE p.id = p_place_id
      AND p.active = true
      AND p.boundary IS NOT NULL;
    
    v_inside_boundary := COALESCE(v_inside_boundary, false);
  END IF;

  -- 2. Check for existing active presence
  SELECT * INTO v_existing_presence
  FROM user_presences
  WHERE user_id = p_user_id
    AND place_id = p_place_id
    AND active = true
    AND ended_at IS NULL
    AND expires_at > NOW()
  ORDER BY entered_at DESC
  LIMIT 1;

  -- 3a. Existing presence found - validate and potentially refresh
  IF v_existing_presence.id IS NOT NULL THEN
    
    -- Case 1: Check-in+ ainda ativo - permitir SEM renovar tempo
    IF v_existing_presence.entry_type = 'checkin_plus' THEN
      -- Não renova, apenas retorna a presença existente
      RETURN jsonb_build_object(
        'status', 'refreshed',
        'presence', row_to_json(v_existing_presence)::jsonb,
        'inside_boundary', v_inside_boundary,
        'renewed', false
      );
    END IF;
    
    -- Case 2: Presença física - VALIDAR boundary antes de renovar
    IF v_existing_presence.entry_type = 'physical' THEN
      -- Se coordenadas fornecidas, validar
      IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN
        IF v_inside_boundary THEN
          -- Dentro do boundary - renovar por mais 1 hora
          v_new_expires_at := NOW() + INTERVAL '1 hour';
          UPDATE user_presences
          SET expires_at = v_new_expires_at,
              lat = p_user_lat,
              lng = p_user_lng
          WHERE id = v_existing_presence.id
          RETURNING * INTO v_existing_presence;
          
          RETURN jsonb_build_object(
            'status', 'refreshed',
            'presence', row_to_json(v_existing_presence)::jsonb,
            'inside_boundary', true,
            'renewed', true
          );
        ELSE
          -- Fora do boundary - rejeitar refresh
          RETURN jsonb_build_object(
            'status', 'rejected',
            'error', 'outside_boundary_on_refresh',
            'inside_boundary', false
          );
        END IF;
      ELSE
        -- Sem coordenadas - permitir refresh (backward compatibility)
        v_new_expires_at := NOW() + INTERVAL '1 hour';
        UPDATE user_presences
        SET expires_at = v_new_expires_at
        WHERE id = v_existing_presence.id
        RETURNING * INTO v_existing_presence;
        
        RETURN jsonb_build_object(
          'status', 'refreshed',
          'presence', row_to_json(v_existing_presence)::jsonb,
          'renewed', true
        );
      END IF;
    END IF;
  END IF;

  -- 3b. No existing presence - validate and create new
  
  -- Determinar duração: 1 hora para ambos os tipos
  v_new_expires_at := NOW() + INTERVAL '1 hour';
  
  IF NOT v_inside_boundary THEN
    IF p_is_checkin_plus THEN
      v_entry_type := 'checkin_plus';
    ELSE
      -- User is outside boundary and not using checkin_plus
      RETURN jsonb_build_object(
        'status', 'rejected',
        'error', 'outside_boundary',
        'inside_boundary', false
      );
    END IF;
  ELSE
    v_entry_type := 'physical';
  END IF;

  -- Insert new presence
  INSERT INTO user_presences (user_id, place_id, lat, lng, active, entry_type, expires_at)
  VALUES (p_user_id, p_place_id, p_user_lat, p_user_lng, true, v_entry_type, v_new_expires_at)
  RETURNING * INTO v_new_presence;

  -- 4. Consume credit if checkin_plus
  IF v_entry_type = 'checkin_plus' THEN
    UPDATE user_checkin_credits
    SET credits = GREATEST(credits - 1, 0),
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    SELECT credits INTO v_remaining_credits
    FROM user_checkin_credits
    WHERE user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'status', 'created',
    'presence', row_to_json(v_new_presence)::jsonb,
    'inside_boundary', v_inside_boundary,
    'remaining_credits', v_remaining_credits,
    'renewed', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION enter_place(uuid, uuid, float, float, boolean) TO service_role;

COMMENT ON FUNCTION enter_place IS 
'Unified enter-place operation with proper validation:
- 1 hour expiration for both physical and checkin_plus
- Physical presence: validates boundary on refresh
- Check-in+ active: returns without renewing time
- Check-in+ expired: requires boundary validation to renew';
