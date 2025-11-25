/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

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
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase
        .from("profile_connect_with")
        .select("option:option_id(key)")
        .eq("user_id", userId),
      supabase
        .from("profile_intentions")
        .select("option:option_id(key)")
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

    const connectWith = (connectRows ?? []).map((row: any) => row.option?.key).filter(Boolean);
    const intentions = (intentionRows ?? []).map((row: any) => row.option?.key).filter(Boolean);
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

    const profilePayload = profile
      ? {
          ...profile,
          gender: genderKey ?? null,
          connectWith,
          intentions,
          photos,
        }
      : null;

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
