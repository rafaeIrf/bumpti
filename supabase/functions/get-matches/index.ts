/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const SIGNED_URL_EXPIRES = 3600;
const USER_PHOTOS_BUCKET = Deno.env.get("USER_PHOTOS_BUCKET") || "user_photos";
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  throw new Error(
    "Missing SUPABASE_URL, SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY env vars for get-matches"
  );
}

const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

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

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user?.id) {
      console.error("get-matches auth error:", userError);
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const { data: matchRows, error: matchError } = await serviceClient
      .from("user_matches")
      .select("id, user_a, user_b, status, matched_at")
      .in("status", ["matched", "active"])
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .order("matched_at", { ascending: false });

    if (matchError) {
      console.error("get-matches match lookup error:", matchError);
      return new Response(
        JSON.stringify({
          error: "match_lookup_failed",
          message: matchError.message,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const matches = matchRows ?? [];
    if (!matches.length) {
      return new Response(JSON.stringify({ matches: [] }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    const otherUserIds = Array.from(
      new Set(
        matches
          .map((m) =>
            m.user_a === user.id ? m.user_b : m.user_b === user.id ? m.user_a : null
          )
          .filter((id): id is string => Boolean(id))
      )
    );

    const [{ data: profileRows, error: profileError }, { data: photoRows, error: photoError }] =
      await Promise.all([
        serviceClient
          .from("profiles")
          .select("id, name")
          .in("id", otherUserIds),
        serviceClient
          .from("profile_photos")
          .select("user_id, url, position")
          .in("user_id", otherUserIds)
          .order("position", { ascending: true }),
      ]);

    if (profileError) {
      console.error("get-matches profiles fetch error:", profileError);
      return new Response(
        JSON.stringify({
          error: "profiles_fetch_failed",
          message: profileError.message,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (photoError) {
      console.error("get-matches photos fetch error:", photoError);
      return new Response(
        JSON.stringify({
          error: "photos_fetch_failed",
          message: photoError.message,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const profileMap = new Map<string, { name: string | null }>();
    (profileRows ?? []).forEach((row) => {
      if (row?.id) {
        profileMap.set(row.id, { name: row.name ?? null });
      }
    });

    const firstPhotoMap = new Map<string, string | null>();
    for (const row of photoRows ?? []) {
      if (!row?.user_id || !row?.url) continue;
      if (!firstPhotoMap.has(row.user_id)) {
        firstPhotoMap.set(row.user_id, row.url);
      }
    }

    const results = [];
    for (const m of matches) {
      const otherUser =
        m.user_a === user.id ? m.user_b : m.user_b === user.id ? m.user_a : null;
      if (!otherUser) continue;

      const profile = profileMap.get(otherUser);
      const fileName = firstPhotoMap.get(otherUser);
      let photoUrl: string | null = null;

      if (fileName) {
        const { data: signed, error: signedError } = await serviceClient.storage
          .from(USER_PHOTOS_BUCKET)
          .createSignedUrl(fileName, SIGNED_URL_EXPIRES);
        if (!signedError && signed?.signedUrl) {
          photoUrl = signed.signedUrl;
        } else if (signedError) {
          console.error("get-matches signed url error:", signedError);
        }
      }

      results.push({
        match_id: m.id,
        user_id: otherUser,
        name: profile?.name ?? null,
        photo_url: photoUrl,
        match_created_at: m.matched_at ?? null,
      });
    }

    results.sort((a, b) => {
      const aTime = a.match_created_at ? new Date(a.match_created_at).getTime() : 0;
      const bTime = b.match_created_at ? new Date(b.match_created_at).getTime() : 0;
      return bTime - aTime;
    });

    return new Response(JSON.stringify({ matches: results }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err: any) {
    console.error("get-matches internal error:", err);
    return new Response(
      JSON.stringify({
        error: "internal_error",
        message: err?.message ?? "Unexpected error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
