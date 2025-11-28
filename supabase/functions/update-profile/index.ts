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
  genderId?: number;
  ageRangeMin?: number;
  ageRangeMax?: number;
  intentions?: number[]; // intention ids
  connectWith?: number[]; // gender ids
  bio?: string;
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

    const payload = (await req.json()) as UpdateProfilePayload;
    if (!payload || typeof payload !== "object") {
      return new Response(
        JSON.stringify({ error: "invalid_payload", message: "Body must be JSON" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const {
      name,
      birthdate,
      genderId,
      ageRangeMin,
      ageRangeMax,
      intentions,
      connectWith,
      bio,
      ...rest
    } = payload;

    // Reject unknown fields only if present and not in rest (optional: for forward compat we allow extra)
    const updates: Record<string, unknown> = {};

    if (name !== undefined) updates.name = name;
    if (birthdate !== undefined) updates.birthdate = birthdate;
    if (genderId !== undefined) updates.gender_id = genderId;
    if (ageRangeMin !== undefined) updates.age_range_min = ageRangeMin;
    if (ageRangeMax !== undefined) updates.age_range_max = ageRangeMax;
    if (bio !== undefined) updates.bio = bio;

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
    if (genderId !== undefined) {
      const { data: genderExists, error: genderError } = await supabase
        .from("gender_options")
        .select("id")
        .eq("id", genderId)
        .eq("active", true)
        .maybeSingle();

      if (genderError || !genderExists) {
        return new Response(
          JSON.stringify({ error: "invalid_gender_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Validate intentions/connect_with if provided
    let validIntentions: number[] | undefined;
    if (Array.isArray(intentions)) {
      if (intentions.length === 0) {
        validIntentions = [];
      } else {
        const { data: intentionRows, error: intentionError } = await supabase
          .from("intention_options")
          .select("id")
          .in("id", intentions);
        if (intentionError) {
          return new Response(
            JSON.stringify({ error: "invalid_intentions" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        validIntentions = (intentionRows ?? []).map((r) => r.id);
      }
    }

    let validConnectWith: number[] | undefined;
    if (Array.isArray(connectWith)) {
      if (connectWith.length === 0) {
        validConnectWith = [];
      } else {
        const { data: connectRows, error: connectError } = await supabase
          .from("gender_options")
          .select("id")
          .in("id", connectWith);
        if (connectError) {
          return new Response(
            JSON.stringify({ error: "invalid_connect_with" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        validConnectWith = (connectRows ?? []).map((r) => r.id);
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
    if (validIntentions) {
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
      if (validIntentions.length > 0) {
        const { error: insertError } = await supabase
          .from("profile_intentions")
        .insert(
          validIntentions.map((id) => ({
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
    if (validConnectWith) {
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
      if (validConnectWith.length > 0) {
        const { error: insertError } = await supabase
          .from("profile_connect_with")
          .insert(
            validConnectWith.map((id) => ({
              user_id: userId,
              gender_id: id,
            }))
          );
        if (insertError) {
          return new Response(
            JSON.stringify({ error: "connect_with_insert_failed", message: insertError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Return updated profile (with relations)
    const [profileResult, connectResult, intentionResult, photosResult] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
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
      ]);

    const { data: profile, error: profileError } = profileResult;
    const { data: connectRows, error: connectError } = connectResult;
    const { data: intentionRows, error: intentionError } = intentionResult;
    const { data: photoRows, error: photoError } = photosResult;

    if (profileError) throw profileError;
    if (connectError) throw connectError;
    if (intentionError) throw intentionError;
    if (photoError) throw photoError;

    const connectWithIds = (connectRows ?? [])
      .map((row: any) => row.gender_id)
      .filter((id: number | null) => id != null);
    const intentionsIds = (intentionRows ?? [])
      .map((row: any) => row.option_id)
      .filter((id: number | null) => id != null);

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

    const profilePayload = profile
      ? {
          ...profile,
          connectWith: connectWithIds,
          intentions: intentionsIds,
          photos,
        }
      : null;

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
