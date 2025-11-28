/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

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

    const now = new Date();

    let excludeIds = new Set<string>();

    try {
      const [
        interactionsFromMe,
        interactionsToMe,
        matchesFromMe,
        matchesToMe,
      ] = await Promise.all([
        client
          .from("user_interactions")
          .select("to_user_id, action, action_expires_at")
          .eq("from_user_id", user.id)
          .in("to_user_id", candidateIds),
        client
          .from("user_interactions")
          .select("from_user_id, action, action_expires_at")
          .eq("to_user_id", user.id)
          .in("from_user_id", candidateIds),
        client
          .from("user_matches")
          .select("user_a, user_b, status")
          .eq("user_a", user.id)
          .in("user_b", candidateIds)
          .in("status", ["matched", "active", "unmatched"]),
        client
          .from("user_matches")
          .select("user_a, user_b, status")
          .eq("user_b", user.id)
          .in("user_a", candidateIds)
          .in("status", ["matched", "active", "unmatched"]),
    ]);

      if (interactionsFromMe.error) throw interactionsFromMe.error;
      if (interactionsToMe.error) throw interactionsToMe.error;
      if (matchesFromMe.error) throw matchesFromMe.error;
      if (matchesToMe.error) throw matchesToMe.error;

      (interactionsFromMe.data ?? []).forEach((row) => {
        if (row.action === "dislike") {
          excludeIds.add(row.to_user_id);
        }
        if (
          row.action === "like" &&
          row.action_expires_at &&
          new Date(row.action_expires_at) > now
        ) {
          excludeIds.add(row.to_user_id);
        }
      });

      (interactionsToMe.data ?? []).forEach((row) => {
        const candidateId = row.from_user_id;
        if (row.action === "dislike") {
          excludeIds.add(candidateId);
        }
        if (
          row.action === "like" &&
          row.action_expires_at &&
          new Date(row.action_expires_at) > now
        ) {
          excludeIds.add(candidateId);
        }
      });

      [...(matchesFromMe.data ?? []), ...(matchesToMe.data ?? [])].forEach(
        (row) => {
          const candidateId =
            row.user_a === user.id ? row.user_b : row.user_a;
          excludeIds.add(candidateId);
        }
      );
    } catch (filterError) {
      console.error("get-active-users-at-place filters error:", filterError);
      excludeIds = new Set<string>();
    }

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
