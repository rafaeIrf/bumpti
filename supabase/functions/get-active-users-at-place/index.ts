/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { getExcludedUserIds } from "../_shared/filter-eligible-users.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

const SIGNED_URL_EXPIRES = 3600;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars");
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const serviceSupabase = supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey)
      : supabase;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const url = new URL(req.url);
    const queryPlaceId = url.searchParams.get("place_id");
    const bodyParams =
      req.method === "POST"
        ? (await req.json().catch(() => null))
        : null;
    const placeId = queryPlaceId || bodyParams?.place_id;

    if (!placeId || typeof placeId !== "string") {
      return new Response(JSON.stringify({ error: "invalid_place_id" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const client = serviceSupabase;

    const { data: rows, error: fetchError } = await client
      .from("active_users_per_place")
      .select(
        "place_id, user_id, name, age, bio, intentions, photos, entered_at, expires_at"
      )
      .eq("place_id", placeId)
      .neq("user_id", user.id)
      .order("entered_at", { ascending: false });

    if (fetchError) throw fetchError;

    const candidateIds = Array.from(
      new Set((rows ?? []).map((row) => row.user_id).filter(Boolean))
    );

    if (!candidateIds.length) {
      return new Response(
        JSON.stringify({
          place_id: placeId,
          count: 0,
          users: [],
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Filter out users based on interactions and matches
    const excludeIds = await getExcludedUserIds(
      client,
      user.id,
      candidateIds
    );

    const filteredRows = (rows ?? []).filter(
      (row) => !excludeIds.has(row.user_id)
    );

    const users =
      await Promise.all(
        filteredRows.map(async (row) => {
          const photos = Array.isArray(row.photos) ? row.photos : [];
          const signedPhotos = await Promise.all(
            photos.map(async (filename: string | null) => {
              if (!filename) return null;
              const { data, error } = await serviceSupabase.storage
                .from("user_photos")
                .createSignedUrl(filename, SIGNED_URL_EXPIRES);
              if (error || !data?.signedUrl) {
                console.error("signed url error", { filename, error });
                return null;
              }
              return data.signedUrl;
            })
          );

          return {
            user_id: row.user_id,
            name: row.name,
            age: row.age,
            bio: row.bio,
            intentions: Array.isArray(row.intentions)
              ? row.intentions.map((i) => (i == null ? null : String(i)))
              : [],
            photos: signedPhotos.filter((url): url is string => Boolean(url)),
            entered_at: row.entered_at,
            expires_at: row.expires_at,
          };
        })
      ) ?? [];

    return new Response(
      JSON.stringify({
        place_id: placeId,
        count: users.length,
        users,
      }),
      { status: 200, headers: corsHeaders }
    );
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
