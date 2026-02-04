/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const userPhotosBucket = Deno.env.get("USER_PHOTOS_BUCKET") || "user_photos";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

type UpdateProfilePayload = {
  name?: string;
  birthdate?: string; // ISO date
  gender?: string; // gender key
  ageRangeMin?: number;
  ageRangeMax?: number;
  connectWith?: string[]; // gender keys
  intentions?: string[]; // intention keys
  bio?: string;
  job_title?: string | null;
  company_name?: string | null;
  city_name?: string;
  city_state?: string;
  city_country?: string;
  city_lat?: number;
  city_lng?: number;
  education_key?: string;
  zodiac_key?: string;
  smoking_key?: string;
  relationship_key?: string;
  height_cm?: number;
  favoritePlaces?: string[]; // array of place_ids
  is_invisible?: boolean; // Invisible mode flag
  filter_only_verified?: boolean; // Trust Circle filter flag
  university_id?: string | null;
  university_name_custom?: string | null;
  graduation_year?: number | null;
  show_university_on_home?: boolean;
  last_lat?: number; // GPS latitude for nearby notifications
  last_lng?: number; // GPS longitude for nearby notifications
  [key: string]: unknown;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(
      token
    );
    if (userError || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    let payload: UpdateProfilePayload = {};
    let photosToUpdate: (File | string)[] | null = null;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      payload = (await req.json()) as UpdateProfilePayload;
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      if (formData.has("photos")) {
        photosToUpdate = formData.getAll("photos");
      }
      
      // Parse other fields from formData if needed (currently only photos are sent via FormData)
      // If we wanted to support mixed updates, we'd parse them here.
      // For now, we assume FormData is primarily for photos.
    } else {
      return new Response(
        JSON.stringify({ error: "invalid_content_type", message: "Content-Type must be application/json or multipart/form-data" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!payload || typeof payload !== "object") {
      payload = {}; // Ensure payload is an object
    }

    const {
      name,
      birthdate,
      gender,
      ageRangeMin,
      ageRangeMax,
      intentions,
      connectWith,
      bio,
      job_title,
      company_name,
      city_name,
      city_state,
      city_country,
      city_lat,
      city_lng,
      education_key,
      zodiac_key,
      smoking_key,
      relationship_key,
      height_cm,
      languages,
      favoritePlaces,
      is_invisible,
      filter_only_verified,
      university_id,
      university_name_custom,
      graduation_year,
      show_university_on_home,
      last_lat,
      last_lng,
      ...rest
    } = payload;

    // Lookup IDs for keys
    let educationId: number | undefined;
    if (education_key) {
      const { data, error } = await supabase
        .from("education_levels")
        .select("id")
        .eq("key", education_key)
        .maybeSingle();
      if (error || !data)
        return new Response(
          JSON.stringify({ error: "invalid_education_key" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      educationId = data.id;
    }

    let resolvedGenderId: number | undefined;
    if (gender) {
      const { data, error } = await supabase
        .from("gender_options")
        .select("id")
        .eq("key", gender)
        .maybeSingle();
      if (error || !data)
        return new Response(JSON.stringify({ error: "invalid_gender_key" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      resolvedGenderId = data.id;
    }

    let zodiacId: number | undefined;
    if (zodiac_key) {
      const { data, error } = await supabase
        .from("zodiac_signs")
        .select("id")
        .eq("key", zodiac_key)
        .maybeSingle();
      if (error || !data)
        return new Response(JSON.stringify({ error: "invalid_zodiac_key" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      zodiacId = data.id;
    }

    let smokingId: number | undefined;
    if (smoking_key) {
      const { data, error } = await supabase
        .from("smoking_habits")
        .select("id")
        .eq("key", smoking_key)
        .maybeSingle();
      if (error || !data)
        return new Response(JSON.stringify({ error: "invalid_smoking_key" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      smokingId = data.id;
    }

    let relationshipId: number | undefined;
    if (relationship_key) {
      const { data, error } = await supabase
        .from("relationship_status")
        .select("id")
        .eq("key", relationship_key)
        .maybeSingle();
      if (error || !data)
        return new Response(
          JSON.stringify({ error: "invalid_relationship_key" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      relationshipId = data.id;
    }

    let validLanguages: number[] | undefined;
    if (Array.isArray(languages)) {
      if (languages.length === 0) {
        validLanguages = [];
      } else {
        const { data: languageRows, error: languageError } = await supabase
          .from("languages")
          .select("id")
          .in("key", languages);
        if (languageError) {
          return new Response(JSON.stringify({ error: "invalid_languages" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        validLanguages = (languageRows ?? []).map((r) => r.id);
      }
    }

    // Resolve Intentions Keys to IDs
    let validIntentionIds: number[] | undefined;
    if (Array.isArray(intentions)) {
      if (intentions.length === 0) {
        validIntentionIds = [];
      } else {
        const { data: intentionRows, error: intentionError } = await supabase
          .from("intention_options")
          .select("id")
          .in("key", intentions);
        
        if (intentionError) {
          return new Response(
            JSON.stringify({ error: "invalid_intentions" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        validIntentionIds = (intentionRows ?? []).map((r) => r.id);
      }
    }

    // Resolve ConnectWith (Gender) Keys to IDs
    let validConnectWithIds: number[] | undefined;
    if (Array.isArray(connectWith)) {
      if (connectWith.length === 0) {
        validConnectWithIds = [];
      } else {
        const isAll = connectWith.includes("all");
        // If 'all' is sent (though client usually filters it), we might want to handle it
        // based on business logic. Assuming strict keys here matching DB.
        // If client sends "all", we probably shouldn't be here or we treat it as all genders.
        // Assuming client sends specific gender keys.

        const { data: connectRows, error: connectError } = await supabase
          .from("gender_options")
          .select("id")
          .in("key", connectWith);
          
        if (connectError) {
          return new Response(
            JSON.stringify({ error: "invalid_connect_with" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        validConnectWithIds = (connectRows ?? []).map((r) => r.id);
      }
    }

    // Reject unknown fields only if present and not in rest (optional: for forward compat we allow extra)
    const updates: Record<string, unknown> = {};

    if (name !== undefined) updates.name = name;
    if (birthdate !== undefined) updates.birthdate = birthdate;
    if (resolvedGenderId !== undefined) updates.gender_id = resolvedGenderId;
    if (ageRangeMin !== undefined) updates.age_range_min = ageRangeMin;
    if (ageRangeMax !== undefined) updates.age_range_max = ageRangeMax;
    if (bio !== undefined) updates.bio = bio;
    if (job_title !== undefined) updates.job_title = job_title;
    if (company_name !== undefined) updates.company_name = company_name;
    if (city_name !== undefined) updates.city_name = city_name;
    if (city_state !== undefined) updates.city_state = city_state;
    if (city_country !== undefined) updates.city_country = city_country;
    if (city_lat !== undefined) updates.city_lat = city_lat;
    if (city_lng !== undefined) updates.city_lng = city_lng;
    if (educationId !== undefined) updates.education_id = educationId;
    if (zodiacId !== undefined) updates.zodiac_id = zodiacId;
    if (smokingId !== undefined) updates.smoking_id = smokingId;
    if (relationshipId !== undefined) updates.relationship_id = relationshipId;
    if (height_cm !== undefined) updates.height_cm = height_cm;
    
    // Validate invisible mode: only premium users can enable it
    if (is_invisible !== undefined) {
      if (is_invisible === true) {
        // Check if user is premium
        const { data: profileData } = await supabase
          .from("profiles")
          .select("subscription:user_subscriptions!inner(is_premium)")
          .eq("id", userId)
          .maybeSingle();

        const isPremium = (profileData?.subscription as any)?.is_premium ?? false;

        if (!isPremium) {
          return new Response(
            JSON.stringify({ 
              error: "premium_required", 
              message: "Invisible mode is only available for premium users" 
            }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      updates.is_invisible = is_invisible;
    }

    // Validate Trust Circle filter: only verified users can enable it
    if (filter_only_verified !== undefined) {
      if (filter_only_verified === true) {
        // Check if user is verified
        const { data: profileData } = await supabase
          .from("profiles")
          .select("verification_status")
          .eq("id", userId)
          .maybeSingle();

        if (profileData?.verification_status !== 'verified') {
          return new Response(
            JSON.stringify({ 
              error: "verification_required", 
              message: "Only verified users can enable the Trust Circle filter" 
            }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      updates.filter_only_verified = filter_only_verified;
    }

    // Validate university_id: must exist in places with category 'university'
    if (university_id !== undefined) {
      if (university_id !== null) {
        const { data, error } = await supabase
          .from("places")
          .select("id")
          .eq("id", university_id)
          .eq("category", "university")
          .maybeSingle();
        if (error || !data) {
          return new Response(
            JSON.stringify({ error: "invalid_university_id", message: "University not found in places table" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      updates.university_id = university_id;
    }

    // University custom name (for universities not in places table)
    if (university_name_custom !== undefined) {
      updates.university_name_custom = university_name_custom;
    }

    // Validate graduation_year range
    if (graduation_year !== undefined) {
      if (graduation_year !== null && (graduation_year < 1950 || graduation_year > 2100)) {
        return new Response(
          JSON.stringify({ error: "invalid_graduation_year", message: "graduation_year must be between 1950 and 2100" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      updates.graduation_year = graduation_year;
    }

    // Show university on home preference
    if (show_university_on_home !== undefined) {
      updates.show_university_on_home = show_university_on_home;
    }

    // Last known location for nearby activity notifications
    // When location is updated, automatically set the timestamp
    if (last_lat !== undefined || last_lng !== undefined) {
      // Validate coordinates
      if (last_lat !== undefined) {
        if (last_lat < -90 || last_lat > 90) {
          return new Response(
            JSON.stringify({ error: "invalid_last_lat", message: "last_lat must be between -90 and 90" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        updates.last_lat = last_lat;
      }
      if (last_lng !== undefined) {
        if (last_lng < -180 || last_lng > 180) {
          return new Response(
            JSON.stringify({ error: "invalid_last_lng", message: "last_lng must be between -180 and 180" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        updates.last_lng = last_lng;
      }
      // Automatically set timestamp when location is updated
      updates.last_location_updated_at = new Date().toISOString();
    }

    // Basic validations
    if (ageRangeMin !== undefined && ageRangeMin < 18) {
      return new Response(
        JSON.stringify({ error: "invalid_age_range_min", message: "ageRangeMin must be >= 18" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (ageRangeMax !== undefined && ageRangeMax > 100) {
      return new Response(
        JSON.stringify({ error: "invalid_age_range_max", message: "ageRangeMax must be <= 100" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (
      ageRangeMin !== undefined &&
      ageRangeMax !== undefined &&
      ageRangeMin > ageRangeMax
    ) {
      return new Response(
        JSON.stringify({
          error: "invalid_age_range",
          message: "ageRangeMin must be <= ageRangeMax",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate gender_id if provided
    if (resolvedGenderId !== undefined) {
      const { data: genderExists, error: genderError } = await supabase
        .from("gender_options")
        .select("id")
        .eq("id", resolvedGenderId)
        .eq("active", true)
        .maybeSingle();

      if (genderError || !genderExists) {
        return new Response(
          JSON.stringify({ error: "invalid_gender_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Only run update if we have any profile fields to set
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId);
      if (updateError) {
        return new Response(
          JSON.stringify({ error: "update_failed", message: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Manage intentions
    if (validIntentionIds) {
      const { error: deleteError } = await supabase
        .from("profile_intentions")
        .delete()
        .eq("user_id", userId);
      if (deleteError) {
        return new Response(
          JSON.stringify({ error: "intentions_delete_failed", message: deleteError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (validIntentionIds.length > 0) {
        const { error: insertError } = await supabase
          .from("profile_intentions")
          .insert(
            validIntentionIds.map((id) => ({
              user_id: userId,
              option_id: id,
            }))
          );
        if (insertError) {
          return new Response(
            JSON.stringify({ error: "intentions_insert_failed", message: insertError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Manage connect_with
    if (validConnectWithIds) {
      const { error: deleteError } = await supabase
        .from("profile_connect_with")
        .delete()
        .eq("user_id", userId);
      if (deleteError) {
        return new Response(
          JSON.stringify({ error: "connect_with_delete_failed", message: deleteError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (validConnectWithIds.length > 0) {
        const { error: insertError } = await supabase
          .from("profile_connect_with")
          .insert(
            validConnectWithIds.map((id) => ({
              user_id: userId,
              gender_id: id,
            }))
          );
        if (insertError) {
          return new Response(
            JSON.stringify({
              error: "connect_with_insert_failed",
              message: insertError.message,
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }
    }

    // Manage languages
    if (validLanguages) {
      const { error: deleteError } = await supabase
        .from("profile_languages")
        .delete()
        .eq("user_id", userId);
      if (deleteError) {
        return new Response(
          JSON.stringify({
            error: "languages_delete_failed",
            message: deleteError.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (validLanguages.length > 0) {
        const { error: insertError } = await supabase
          .from("profile_languages")
          .insert(
            validLanguages.map((id) => ({
              user_id: userId,
              language_id: id,
            }))
          );
        if (insertError) {
          return new Response(
            JSON.stringify({
              error: "languages_insert_failed",
              message: insertError.message,
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }
    }

    // Manage favorite places
    if (Array.isArray(favoritePlaces)) {
      const { error: deleteError } = await supabase
        .from("profile_favorite_places")
        .delete()
        .eq("user_id", userId);

      if (deleteError) {
        return new Response(
          JSON.stringify({
            error: "favorite_places_delete_failed",
            message: deleteError.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (favoritePlaces.length > 0) {
        const { error: insertError } = await supabase
          .from("profile_favorite_places")
          .insert(
            favoritePlaces.map((placeId) => ({
              user_id: userId,
              place_id: placeId,
            }))
          );

        if (insertError) {
          return new Response(
            JSON.stringify({
              error: "favorite_places_insert_failed",
              message: insertError.message,
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }
    }

    // Manage photos
    if (photosToUpdate && photosToUpdate.length > 0) {
      // Fetch current photos to identify what needs to be deleted later
      const { data: currentPhotos } = await supabase
        .from("profile_photos")
        .select("url")
        .eq("user_id", userId);

      const newPhotos: { url: string; position: number }[] = [];

      for (let i = 0; i < photosToUpdate.length; i++) {
        const item = photosToUpdate[i];

        if (typeof item === "string") {
          // Existing photo URL (likely signed)
          let path = item;
          try {
            const urlObj = new URL(item);
            if (urlObj.pathname.includes(`/sign/${userPhotosBucket}/`)) {
               path = urlObj.pathname.split(`/sign/${userPhotosBucket}/`)[1];
               path = decodeURIComponent(path);
            }
          } catch (e) {
            // Not a URL, assume it is the path
          }
          newPhotos.push({ url: path, position: i });

        } else if (item instanceof File) {
          // New file upload
          const fileExt = item.name.split(".").pop();
          const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from(userPhotosBucket)
            .upload(fileName, item, {
              contentType: item.type,
              upsert: true,
            });

          if (uploadError) {
             console.error("Upload error:", uploadError);
             throw new Error("Failed to upload photo");
          }
          
          newPhotos.push({ url: fileName, position: i });
        }
      }

      // Delete removed photos from storage
      if (currentPhotos) {
        const newPhotoPaths = new Set(newPhotos.map((p) => p.url));
        const photosToDelete = currentPhotos
          .map((p) => p.url)
          .filter((url) => !newPhotoPaths.has(url));

        if (photosToDelete.length > 0) {
          const { error: removeError } = await supabase.storage
            .from(userPhotosBucket)
            .remove(photosToDelete);

          if (removeError) {
            console.error(
              "Failed to remove old photos from storage:",
              removeError
            );
          }
        }
      }

      // Replace photos in DB
      const { error: deleteError } = await supabase
        .from("profile_photos")
        .delete()
        .eq("user_id", userId);
        
      if (deleteError) {
         throw new Error("Failed to delete old photos");
      }

      if (newPhotos.length > 0) {
        const { error: insertError } = await supabase
          .from("profile_photos")
          .insert(
            newPhotos.map((p) => ({
              user_id: userId,
              url: p.url,
              position: p.position,
            }))
          );
          
        if (insertError) {
           throw new Error("Failed to insert new photos");
        }
      }
    }

    // Return updated profile (with relations)
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
          profile_languages(language:languages(key)),
          university:places!university_id(name, lat, lng)
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

    const connectWithIds = (connectRows ?? [])
      .map((row: any) => row.gender?.key)
      .filter((key: string | null) => key != null);
    const intentionsIds = (intentionRows ?? [])
      .map((row: any) => row.intention?.key)
      .filter((key: string | null) => key != null);
    const favoritePlacesIds = (favoritePlacesRows ?? [])
      .map((row: any) => row.place_id)
      .filter((id: string | null) => id != null);

    let photos =
      (photoRows ?? [])
        .map((row: any) => ({
          path: row.url,
          position: row.position ?? 0,
        }))
        .filter((p: any) => !!p.path)
        .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));

    const signedPhotos: { url: string; position: number }[] = [];
    for (const photo of photos) {
      const { data: signedData, error: signedError } = await supabase.storage
        .from(userPhotosBucket)
        .createSignedUrl(photo.path, 60 * 60 * 24 * 7);

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
      const {
        education,
        zodiac,
        smoking,
        relationship,
        profile_languages,
        university,
        ...rest
      } = profile;

      const location = rest.city_name
        ? `${rest.city_name}${rest.city_state ? `, ${rest.city_state}` : ""}`
        : rest.location;


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

      profilePayload = {
        ...rest,
        location,
        connectWith: connectWithIds,
        intentions: intentionsIds,
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
        // University fields from joined places table
        university_name: university?.name ?? null,
        university_lat: university?.lat ?? null,
        university_lng: university?.lng ?? null,
      };
    }

    return new Response(JSON.stringify({ profile: profilePayload }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("update-profile error:", error);
    return new Response(
      JSON.stringify({ error: "internal_error", message: error?.message ?? "Unexpected error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
