/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const USER_PHOTOS_BUCKET = Deno.env.get("USER_PHOTOS_BUCKET") || "user_photos";
const SIGNED_URL_EXPIRES = 3600;

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const serviceClient = supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey)
      : null;

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user?.id) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const selectClient = serviceClient ?? userClient;

    const { data: rows, error: viewError } = await selectClient
      .from("match_overview")
      .select(
        "match_id, chat_id, matched_at, place_id, place_name, user_a, user_b, user_a_name, user_b_name, user_a_photo_url, user_b_photo_url, user_a_opened_at, user_b_opened_at"
      )
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .order("matched_at", { ascending: false });

    if (viewError) {
      return new Response(
        JSON.stringify({
          error: "matches_fetch_failed",
          message: viewError.message,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const signedPhotoMap = new Map<string, string | null>();
    if (serviceClient) {
      const photoItems = Array.from(
        new Set(
          (rows ?? [])
            .map((r) => {
              const isUserA = r.user_a === user.id;
              const path =
                (isUserA ? r.user_b_photo_url : r.user_a_photo_url) ?? null;
              const otherId = isUserA ? r.user_b : r.user_a;
              return path && otherId ? `${otherId}::${path}` : null;
            })
            .filter(Boolean) as string[]
        )
      );
      for (const item of photoItems) {
        const [otherId, path] = item.split("::");
        const { data: signed, error: signedError } = await serviceClient.storage
          .from(USER_PHOTOS_BUCKET)
          .createSignedUrl(path, SIGNED_URL_EXPIRES);
        if (!signedError && signed?.signedUrl) {
          signedPhotoMap.set(otherId, signed.signedUrl);
        } else {
          signedPhotoMap.set(otherId, null);
        }
      }
    }



    const matches =
      rows?.map((row: any) => {
        const isUserA = row.user_a === user.id;
        const otherUserId = isUserA ? row.user_b : row.user_a;
        const otherUserName = isUserA ? row.user_b_name : row.user_a_name;
        const isNewMatch = isUserA
          ? row.user_a_opened_at === null
          : row.user_b_opened_at === null;
        const photoPath =
          (isUserA ? row.user_b_photo_url : row.user_a_photo_url) ?? null;
        const photoUrl =
          photoPath == null
            ? null
            : signedPhotoMap.get(otherUserId) ?? null;

        return {
          match_id: row.match_id,
          chat_id: row.chat_id,
          matched_at: row.matched_at,
          place_id: row.place_id ?? null,
          place_name: row.place_name ?? null,
          is_new_match: Boolean(isNewMatch),
          other_user: {
            id: otherUserId,
            name: otherUserName,
            photo_url: photoUrl,
          },
        };
      }) ?? [];

    return new Response(JSON.stringify({ matches }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: "internal_error",
        message: err?.message ?? "Unexpected error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
