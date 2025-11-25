/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const userPhotosBucket = Deno.env.get("USER_PHOTOS_BUCKET") || "user_photos";

if (!supabaseUrl || !serviceKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
}

const supabase = createClient(supabaseUrl, serviceKey);

function getFileExtension(fileName?: string, contentType?: string) {
  if (fileName && fileName.includes(".")) {
    return fileName.split(".").pop() ?? "jpg";
  }
  if (contentType) {
    if (contentType === "image/png") return "png";
    if (contentType === "image/webp") return "webp";
    if (contentType === "image/jpeg") return "jpg";
  }
  return "jpg";
}

async function uploadPhotos(
  userId: string,
  photos: File[]
): Promise<{ paths: string[]; positions: number[] }> {
  const paths: string[] = [];
  const positions: number[] = [];

  // Remove existing photos for this user before uploading new ones
  const { data: existing } = await supabase.storage
    .from(userPhotosBucket)
    .list(userId);
  if (existing && existing.length > 0) {
    const filesToRemove = existing.map((f) => `${userId}/${f.name}`);
    await supabase.storage.from(userPhotosBucket).remove(filesToRemove);
  }

  for (const [index, photo] of photos.entries()) {
    const ext = getFileExtension(photo.name, photo.type);
    const path = `${userId}/${crypto.randomUUID() || `photo-${index}`}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(userPhotosBucket)
      .upload(path, photo, {
        cacheControl: "3600",
        upsert: true,
        contentType: photo.type ?? "image/jpeg",
      });

    if (uploadError) throw uploadError;

    paths.push(path);
    positions.push(index);
  }

  return { paths, positions };
}

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

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return new Response(
      JSON.stringify({ error: "unauthorized", message: "Missing access token" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return new Response(
        JSON.stringify({ error: "invalid_content_type", message: "Use multipart/form-data." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formData = await req.formData();
    const name = (formData.get("name") as string | null) || null;
    const birthdateRaw = (formData.get("birthdate") as string | null) || null;
    const birthdate =
      birthdateRaw && /^\d{4}-\d{2}-\d{2}$/.test(birthdateRaw) ? birthdateRaw : null;
    const genderKey = (formData.get("gender") as string | null) || null;
    const connectWith =
      (formData.get("connectWith") as string | null)?.length
        ? JSON.parse(formData.get("connectWith") as string)
        : [];
    const intentions =
      (formData.get("intentions") as string | null)?.length
        ? JSON.parse(formData.get("intentions") as string)
        : [];
    const photos = formData.getAll("photos").filter((f): f is File => f instanceof File);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user?.id) {
      throw new Error(userError?.message ?? "User not found");
    }

    const connectPromise = connectWith.length
      ? supabase.from("connect_options").select("id,key").in("key", connectWith).eq("active", true)
      : Promise.resolve({ data: [], error: null });

    const intentionPromise = intentions.length
      ? supabase.from("intention_options").select("id,key").in("key", intentions).eq("active", true)
      : Promise.resolve({ data: [], error: null });

    const [{ data: connectOptions, error: connectError }, { data: intentionOptions, error: intentionError }] =
      await Promise.all([connectPromise, intentionPromise]);

    if (connectError) throw connectError;
    if (intentionError) throw intentionError;

    if ((connectWith.length && (connectOptions?.length ?? 0) !== connectWith.length) ||
        (intentions.length && (intentionOptions?.length ?? 0) !== intentions.length)) {
      return new Response(
        JSON.stringify({ error: "invalid_options", message: "Some provided options are invalid or inactive." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const connectIds = (connectOptions ?? []).map((o) => o.id);
    const intentionIds = (intentionOptions ?? []).map((o) => o.id);

    // Resolve gender_id
    let genderId: number | null = null;
    if (genderKey) {
      const { data: genders, error: genderError } = await supabase
        .from("gender_options")
        .select("id,key")
        .eq("key", genderKey);

      if (genderError) throw genderError;
      if (!genders || genders.length === 0) {
        return new Response(
          JSON.stringify({
            error: "invalid_gender",
            message: "Invalid gender option.",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      genderId = genders[0].id;
    }

    let photoPaths: string[] = [];
    let photoPositions: number[] = [];

    if (photos.length) {
      const uploaded = await uploadPhotos(user.id, photos);
      photoPaths = uploaded.paths;
      photoPositions = uploaded.positions;
    }

    const { error: rpcError } = await supabase.rpc("save_onboarding_txn", {
      p_user_id: user.id,
      p_name: name ?? null,
      p_birthdate: birthdate,
      p_gender_id: genderId,
      p_connect_ids: connectIds,
      p_intention_ids: intentionIds,
      p_photo_urls: photoPaths,
      p_photo_positions: photoPositions,
    });

    if (rpcError) {
      throw rpcError;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("save-onboarding error:", error);
    return new Response(
      JSON.stringify({
        error: "save_failed",
        message: error?.message ?? "Unable to save onboarding data.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
