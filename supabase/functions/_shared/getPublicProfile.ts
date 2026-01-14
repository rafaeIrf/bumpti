/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />

// Signed URLs válidas por 24 horas
// Garantem que fotos funcionem offline por um dia inteiro após o fetch
const SIGNED_URL_EXPIRES = 60 * 60 * 24; // 86400 segundos = 24 horas

export async function getPublicProfile(
  supabaseClient: any,
  supabaseService: any,
  userId: string
) {
  // Parallel fetch of profile data
  const [
    profileResult,
    connectResult,
    intentionResult,
    photosResult,
    favoritePlacesResult,
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
          profile_languages(language:languages(key))
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
  ]);

  const profile = profileResult.data;
  if (!profile) {
    return null;
  }

  // Calculate age
  let age = null;
  if (profile.birthdate) {
    const birth = new Date(profile.birthdate);
    const now = new Date();
    age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
  }

  // Process lists
  const intentions = (intentionResult.data ?? [])
    .map((row: any) => row.intention?.key)
    .filter(Boolean);

  // Photos - sign urls
  const photoRows = photosResult.data ?? [];
  const signedPhotos = await Promise.all(
    photoRows.map(async (row: any) => {
      if (!row.url) return null;
      const { data } = await supabaseService.storage
        .from("user_photos")
        .createSignedUrl(row.url, SIGNED_URL_EXPIRES);
      return data?.signedUrl ?? null;
    })
  );
  const photos = signedPhotos.filter((url): url is string => !!url);

  // Favorite Places - now with joined data
  const favorite_places = (favoritePlacesResult.data ?? [])
    .map((row: any) => {
      const place = row.places;
      if (!place) return null;
      return {
        id: place.id,
        name: place.name || "",
        category: place.category || "",
      };
    })
    .filter((p): p is { id: string; name: string; category: string } => p !== null);

  // Languages
  const languages =
    profile.profile_languages
      ?.map((pl: any) => pl.language?.key)
      .filter(Boolean) ?? [];

  return {
    user_id: profile.id,
    name: profile.name,
    age,
    bio: profile.bio,
    intentions,
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
    favorite_places,
    entered_at: null, // Context specific
    expires_at: null, // Context specific
    place_id: null, // Context specific
    visited_places_count: favorite_places.length,
  };
}
