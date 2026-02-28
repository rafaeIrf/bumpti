/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />

const SIGNED_URL_EXPIRES = 60 * 60 * 24; // 24 hours

// ─── Helpers ────────────────────────────────────────────────────────

type PlaceSummary = { id: string; name: string; category: string };

/** Extract { id, name, category } from joined place rows, discarding nulls. */
function parsePlaceRows(rows: any[]): PlaceSummary[] {
  return rows.reduce<PlaceSummary[]>((acc, row) => {
    const place = row.places;
    if (place) {
      acc.push({
        id: place.id,
        name: place.name || "",
        category: place.category || "",
      });
    }
    return acc;
  }, []);
}

/** Calculate age from a birthdate string. */
function calculateAge(birthdate: string | null): number | null {
  if (!birthdate) return null;
  const birth = new Date(birthdate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

// ─── Main ───────────────────────────────────────────────────────────

export async function getPublicProfile(
  _supabaseClient: any,
  supabaseService: any,
  userId: string
) {
  // ── Parallel data fetch ─────────────────────────────────────────
  const [
    profileResult,
    ,                       // connectResult — unused
    intentionResult,
    photosResult,
    favoritePlacesResult,
    interestsResult,
    socialHubsResult,
  ] = await Promise.all([
    supabaseService
      .from("profiles")
      .select(
        `
          *,
          education:education_levels(key),
          zodiac:zodiac_signs(key),
          smoking:smoking_habits(key),
          relationship:relationship_status(key),
          profile_languages(language:languages(key)),
          university:places!university_id(name)
        `
      )
      .eq("id", userId)
      .maybeSingle(),
    supabaseService
      .from("profile_connect_with")
      .select("gender:gender_options(key)")
      .eq("user_id", userId),
    supabaseService
      .from("profile_intentions")
      .select("intention:intention_options(key)")
      .eq("user_id", userId),
    supabaseService
      .from("profile_photos")
      .select("url, position")
      .eq("user_id", userId)
      .order("position", { ascending: true }),
    supabaseService
      .from("profile_favorite_places")
      .select("place_id, places:places(id, name, category)")
      .eq("user_id", userId),
    supabaseService
      .from("profile_interests")
      .select("interest:interests(key)")
      .eq("profile_id", userId),
    supabaseService
      .from("profile_social_hubs")
      .select("place_id, visible, places:places(id, name, category)")
      .eq("user_id", userId),
  ]);

  const profile = profileResult.data;
  if (!profile) return null;

  // ── Derived fields ──────────────────────────────────────────────

  const age = calculateAge(profile.birthdate);

  const intentions = (intentionResult.data ?? [])
    .map((row: any) => row.intention?.key)
    .filter(Boolean);

  const interests = (interestsResult.data ?? [])
    .map((row: any) => row.interest?.key)
    .filter(Boolean);

  const languages =
    profile.profile_languages
      ?.map((pl: any) => pl.language?.key)
      .filter(Boolean) ?? [];

  // ── Photos (signed URLs) ────────────────────────────────────────

  const signedPhotos = await Promise.all(
    (photosResult.data ?? []).map(async (row: any) => {
      if (!row.url) return null;
      const { data } = await supabaseService.storage
        .from("user_photos")
        .createSignedUrl(row.url, SIGNED_URL_EXPIRES);
      return data?.signedUrl ?? null;
    })
  );
  const photos = signedPhotos.filter((url): url is string => !!url);

  // ── Places (no avatars needed — this is the public card payload) ─

  const favorite_places = parsePlaceRows(favoritePlacesResult.data ?? []);

  const visibleHubRows = (socialHubsResult.data ?? []).filter(
    (row: any) => row.visible !== false
  );
  const social_hubs = parsePlaceRows(visibleHubRows);

  // ── Response ────────────────────────────────────────────────────

  return {
    user_id: profile.id,
    name: profile.name,
    age,
    bio: profile.bio,
    intentions,
    interests,
    photos,
    job_title: profile.job_title,
    company_name: profile.company_name,
    height_cm: profile.height_cm,
    location: profile.city_name || profile.location,
    languages,
    education_level: profile.education?.key,
    zodiac_sign: profile.zodiac?.key,
    relationship_status: profile.relationship?.key,
    smoking_habit: profile.smoking?.key,
    verification_status: profile.verification_status || null,
    university_id: profile.university_id || null,
    university_name:
      profile.university?.name || profile.university_name_custom || null,
    university_name_custom: profile.university_name_custom || null,
    graduation_year: profile.graduation_year || null,
    show_university_on_home: profile.show_university_on_home ?? false,
    favorite_places,
    social_hubs,
    entered_at: null,
    expires_at: null,
    place_id: null,
    visited_places_count: favorite_places.length,
  };
}
