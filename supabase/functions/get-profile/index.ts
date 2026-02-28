/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { requireAuth } from "../_shared/auth.ts";
import { getEntitlements } from "../_shared/iap-validation.ts";
import { signPhotoUrls } from "../_shared/signPhotoUrls.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const userPhotosBucket = Deno.env.get("USER_PHOTOS_BUCKET") || "user_photos";

if (!supabaseUrl || !serviceKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
}

const supabase = createClient(supabaseUrl, serviceKey);

// ─── Helpers ────────────────────────────────────────────────────────

type PlaceHub = {
  id: string;
  name: string;
  category: string;
  visible: boolean;
  avatars: { user_id: string; url: string }[];
};

/** Fetch active users, regulars count, and signed avatars for a university. */
async function enrichUniversity(client: any, universityId: string | null, userId: string) {
  if (!universityId) {
    return { activeUsers: 0, regularsCount: 0, avatars: [] as { user_id: string; url: string }[] };
  }

  const [activeResult, regularsResult, avatarsResult] = await Promise.all([
    client.rpc("get_eligible_active_users_count", {
      target_place_id: universityId,
      requesting_user_id: userId,
    }),
    client.rpc("get_regulars_count_at_place", {
      target_place_id: universityId,
      requesting_user_id: userId,
    }),
    client.rpc("get_combined_place_avatars", {
      target_place_id: universityId,
      requesting_user_id: userId,
      max_avatars: 5,
    }),
  ]);

  return {
    activeUsers: activeResult.data ?? 0,
    regularsCount: regularsResult.data ?? 0,
    avatars: await signUserAvatars(client, avatarsResult.data ?? []),
  };
}

/** Parse social hub rows and enrich each hub with signed avatars. */
async function enrichSocialHubs(
  client: any,
  socialHubRows: any[] | null,
  userId: string
): Promise<PlaceHub[]> {
  const hubs = (socialHubRows ?? [])
    .map((row: any) => {
      const place = row.places;
      if (!place) return null;
      return {
        id: place.id as string,
        name: (place.name || "") as string,
        category: (place.category || "") as string,
        visible: (row.visible ?? true) as boolean,
      };
    })
    .filter((p): p is Exclude<typeof p, null> => p !== null);

  if (hubs.length === 0) return [];

  // Fetch avatars for every hub in parallel
  const enriched = await Promise.all(
    hubs.map(async (hub) => {
      const { data } = await client.rpc("get_combined_place_avatars", {
        target_place_id: hub.id,
        requesting_user_id: userId,
        max_avatars: 5,
      });
      return {
        ...hub,
        avatars: await signUserAvatars(client, data ?? []),
      };
    })
  );

  return enriched;
}

// ─── Handler ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  // Use requireAuth helper for consistent auth handling
  const authResult = await requireAuth(req);
  if (!authResult.success) {
    return authResult.response;
  }

  const { user } = authResult;
  const userId = user.id;

  try {

    const [
      profileResult,
      connectResult,
      intentionResult,
      photosResult,
      favoritePlacesResult,
      notificationSettingsResult,
      subscription,
      genderOptionsResult,
      interestsResult,
      socialHubsResult,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          `
          *,
          verification_status,
          is_invisible,
          university:places!university_id(id, name, category, lat, lng),
          education:education_levels(key),
          zodiac:zodiac_signs(key),
          smoking:smoking_habits(key),
          relationship:relationship_status(key),
          profile_languages(language:languages(key))
        `
        )
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("profile_connect_with")
        .select("gender:gender_options(key)")
        .eq("user_id", userId),
      supabase
        .from("profile_intentions")
        .select("intention:intention_options(key)")
        .eq("user_id", userId),
      supabase
        .from("profile_photos")
        .select("url, position")
        .eq("user_id", userId)
        .order("position", { ascending: true }),
      supabase
        .from("profile_favorite_places")
        .select("place_id, places:places(id, name, category)")
        .eq("user_id", userId),
      supabase
        .from("notification_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
      getEntitlements(supabase, userId),
      // Include gender query in Promise.all for parallel execution
      supabase
        .from("gender_options")
        .select("id, key"),
      supabase
        .from("profile_interests")
        .select("interest:interests(key)")
        .eq("profile_id", userId),
      supabase
        .from("profile_social_hubs")
        .select("place_id, visible, places:places(id, name, category)")
        .eq("user_id", userId),
    ]);

    const { data: profile, error: profileError } = profileResult;
    const { data: connectRows, error: connectError } = connectResult;
    const { data: intentionRows, error: intentionError } = intentionResult;
    const { data: photoRows, error: photoError } = photosResult;
    const { data: favoritePlacesRows, error: favoritePlacesError } =
      favoritePlacesResult;
    const { data: notificationSettings, error: notificationError } =
      notificationSettingsResult;
    const { data: genderOptions, error: genderError } = genderOptionsResult;
    const { data: interestRows, error: interestsError } = interestsResult;
    const { data: socialHubRows, error: socialHubsError } = socialHubsResult;

    if (profileError) throw profileError;
    if (connectError) throw connectError;
    if (intentionError) throw intentionError;
    if (photoError) throw photoError;
    if (favoritePlacesError) throw favoritePlacesError;
    if (interestsError) throw interestsError;
    if (genderError) throw genderError;
    if (socialHubsError) throw socialHubsError;
    // notificationError is optional, if missing we can execute default logic or just ignore
    // But maybeSingle shouldn't error on no rows, just return null data.
    if (notificationError) console.error("Error fetching notification settings", notificationError);

    // Resolve gender key from pre-fetched options
    const genderKey = profile?.gender_id 
      ? genderOptions?.find((g: any) => g.id === profile.gender_id)?.key ?? null
      : null;

    const connectWith = (connectRows ?? [])
      .map((row: any) => row.gender?.key)
      .filter((key: string | null) => key != null);
    const intentions = (intentionRows ?? [])
      .map((row: any) => row.intention?.key)
      .filter((key: string | null) => key != null);
    const interests = (interestRows ?? [])
      .map((row: any) => row.interest?.key)
      .filter((key: string | null) => key != null);
    
    // Favorite places with joined data
    const favoritePlaces = (favoritePlacesRows ?? [])
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

    let photos =
      (photoRows ?? [])
        .map((row: any) => ({
          path: row.url, // stored path
          position: row.position ?? 0,
        }))
        .filter((p: any) => !!p.path)
        .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));

    // Use shared signPhotoUrls util for consistent URL signing
    const paths = photos.map((p: any) => p.path);
    const signedUrls = await signPhotoUrls(supabase, paths);
    photos = signedUrls.map((url, index) => ({
      url,
      position: photos[index]?.position ?? index,
    }));

    let profilePayload = null;

    if (profile) {
      // Destructure to separate relations from raw profile data
      const {
        education,
        zodiac,
        smoking,
        relationship,
        profile_languages,
        university,
        job_title,
        company_name,
        ...rest
      } = profile;

      const location = rest.city_name
        ? `${rest.city_name}${rest.city_state ? `, ${rest.city_state}` : ""}`
        : rest.location;

      // ── Enrich university with live stats ──────────────────────────
      const universityData = await enrichUniversity(
        supabase, rest.university_id, userId
      );

      // ── Enrich social hubs with avatars + active count ─────────
      const socialHubs = await enrichSocialHubs(
        supabase, socialHubRows, userId
      );

      profilePayload = {
        ...rest,
        job_title: job_title ?? null,
        company_name: company_name ?? null,
        location,
        gender: genderKey ?? null,
        gender_id: rest.gender_id ?? null,
        age_range_min: rest.age_range_min ?? null,
        age_range_max: rest.age_range_max ?? null,
        is_invisible: rest.is_invisible ?? false,
        connectWith,
        intentions,
        favoritePlaces,
        photos,
        interests,
        subscription,
        education_key: education?.key ?? null,
        zodiac_key: zodiac?.key ?? null,
        smoking_key: smoking?.key ?? null,
        relationship_key: relationship?.key ?? null,
        languages:
          profile_languages
            ?.map((pl: any) => pl.language?.key)
            .filter(Boolean) ?? [],
        notification_settings: notificationSettings ?? {
          favorite_places: true,
          nearby_activity: true,
          messages: true,
          matches: true,
          likes: true,
        },
        // University
        university_id: rest.university_id ?? null,
        university_name_custom: rest.university_name_custom ?? null,
        university_name: (university as any)?.name ?? rest.university_name_custom ?? null,
        university_lat: (university as any)?.lat ?? null,
        university_lng: (university as any)?.lng ?? null,
        university_active_users: universityData.activeUsers,
        university_regulars_count: universityData.regularsCount,
        university_presence_avatars: universityData.avatars,
        graduation_year: rest.graduation_year ?? null,
        show_university_on_home: rest.show_university_on_home ?? true,
        email: user.email ?? null,
        socialHubs,
      };
    }

    return new Response(JSON.stringify({ profile: profilePayload }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("get-profile error:", error);
    const message = error?.message ?? "Unable to fetch profile.";
    const status = message.toLowerCase().includes("unauthorized") ? 401 : 500;
    return new Response(
      JSON.stringify({ error: "fetch_profile_failed", message }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
