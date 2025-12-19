CREATE OR REPLACE VIEW public.active_users_per_place AS
SELECT
  up.place_id,
  up.user_id,

  -- dados do usuário
  p.name,
  p.bio,
  date_part(
    'year',
    age(p.birthdate::timestamp with time zone)
  ) AS age,

  -- intenções
  array_remove(
    array_agg(DISTINCT io.key ORDER BY io.key),
    NULL
  ) AS intentions,

  -- fotos
  array_remove(
    array_agg(DISTINCT pp.url ORDER BY pp.url),
    NULL
  ) AS photos,

  -- dados da presença
  up.entered_at,
  up.expires_at

FROM public.user_presences up
JOIN public.profiles p
  ON p.id = up.user_id

LEFT JOIN public.profile_intentions pi
  ON pi.user_id = up.user_id

LEFT JOIN public.intention_options io
  ON io.id = pi.option_id

LEFT JOIN public.profile_photos pp
  ON pp.user_id = up.user_id

WHERE
  up.active = true
  AND up.ended_at IS NULL
  AND up.expires_at > now()

GROUP BY
  up.place_id,
  up.user_id,
  p.name,
  p.bio,
  p.birthdate,
  up.entered_at,
  up.expires_at;
