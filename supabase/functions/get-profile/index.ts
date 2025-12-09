/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { getPlaceDetails } from "../_shared/foursquare/placeDetails.ts";

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

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return new Response(
      JSON.stringify({ error: "unauthorized", message: "Missing access token" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user?.id) {
      throw new Error(userError?.message ?? "User not found");
    }

    const userId = user.id;

    const [
      profileResult,
      connectResult,
      intentionResult,
      photosResult,
      favoritePlacesResult,
    ] = await Promise.all([
      supabase
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
      supabase
        .from("profile_connect_with")
        .select("gender_id")
        .eq("user_id", userId),
      supabase
        .from("profile_intentions")
        .select("option_id")
        .eq("user_id", userId),
      supabase
        .from("profile_photos")
        .select("url, position")
        .eq("user_id", userId)
        .order("position", { ascending: true }),
      supabase
        .from("profile_favorite_places")
        .select("place_id")
        .eq("user_id", userId),
    ]);

    const { data: profile, error: profileError } = profileResult;
    const { data: connectRows, error: connectError } = connectResult;
    const { data: intentionRows, error: intentionError } = intentionResult;
    const { data: photoRows, error: photoError } = photosResult;
    const { data: favoritePlacesRows, error: favoritePlacesError } =
      favoritePlacesResult;

    if (profileError) throw profileError;
    if (connectError) throw connectError;
    if (intentionError) throw intentionError;
    if (photoError) throw photoError;
    if (favoritePlacesError) throw favoritePlacesError;

    // Resolve gender key if gender_id exists
    let genderKey: string | null = null;
    if (profile?.gender_id) {
      const { data: genderRow, error: genderError } = await supabase
        .from("gender_options")
        .select("key")
        .eq("id", profile.gender_id)
        .maybeSingle();

      if (genderError) throw genderError;
      genderKey = genderRow?.key ?? null;
    }

    const connectWith = (connectRows ?? [])
      .map((row: any) => row.gender_id)
      .filter((id: number | null) => id != null);
    const intentions = (intentionRows ?? [])
      .map((row: any) => row.option_id)
      .filter((id: number | null) => id != null);
    
    // Fetch favorite places details from Foursquare
    let favoritePlaces = [];
    const favoritePlaceIds = (favoritePlacesRows ?? [])
      .map((row: any) => row.place_id)
      .filter((id: string | null) => id != null);

    if (favoritePlaceIds.length > 0) {
      try {
        // We don't have user location here, so distance will be 0
        const placesDetails = await getPlaceDetails({
          fsq_ids: favoritePlaceIds,
        });
        
        favoritePlaces = placesDetails.map((place) => ({
          id: place.fsq_id,
          name: place.name,
          category: place.categories?.[0]?.name || "",
        }));
      } catch (error) {
        console.error("Error fetching favorite places details:", error);
        // Fallback to just IDs if API fails
        favoritePlaces = favoritePlaceIds.map((id: string) => ({ id, name: "" }));
      }
    }

    let photos =
      (photoRows ?? [])
        .map((row: any) => ({
          path: row.url, // stored path
          position: row.position ?? 0,
        }))
        .filter((p: any) => !!p.path)
        .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));

    // Generate signed URLs for each photo path (private bucket support)
    const signedPhotos: { url: string; position: number }[] = [];
    for (const photo of photos) {
      const { data: signedData, error: signedError } = await supabase.storage
        .from(userPhotosBucket)
        .createSignedUrl(photo.path, 60 * 60 * 24 * 7); // 7 days

      if (signedError) {
        console.error("createSignedUrl error", signedError);
        continue;
      }

      if (signedData?.signedUrl) {
        signedPhotos.push({ url: signedData.signedUrl, position: photo.position });
      }
    }
    photos = signedPhotos;

    let profilePayload = null;

    if (profile) {
      // Destructure to separate relations from raw profile data
      const {
        education,
        zodiac,
        smoking,
        relationship,
        profile_languages,
        job_title,
        company_name,
        ...rest
      } = profile;

      const location = rest.city_name
        ? `${rest.city_name}${rest.city_state ? `, ${rest.city_state}` : ""}`
        : rest.location;

      profilePayload = {
        ...rest,
        job_title: job_title ?? null,
        company_name: company_name ?? null,
        location,
        gender: genderKey ?? null,
        gender_id: rest.gender_id ?? null,
        age_range_min: rest.age_range_min ?? null,
        age_range_max: rest.age_range_max ?? null,
        connectWith,
        intentions,
        favoritePlaces,
        photos,
        education_key: education?.key ?? null,
        zodiac_key: zodiac?.key ?? null,
        smoking_key: smoking?.key ?? null,
        relationship_key: relationship?.key ?? null,
        languages:
          profile_languages
            ?.map((pl: any) => pl.language?.key)
            .filter(Boolean) ?? [],
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
