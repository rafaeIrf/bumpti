/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
}

const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const serviceClient = SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

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
    if (!serviceClient) {
      return new Response(JSON.stringify({ error: "service_key_missing" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const {
      data: { user },
      error: userError,
    } = await anonClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const body = await req.json().catch(() => null);
    const matchId = body?.match_id as string | undefined;
    const status = body?.status as string | undefined;
    const markOpened = body?.mark_opened as boolean | undefined;

    if (!matchId || typeof matchId !== "string") {
      return new Response(JSON.stringify({ error: "invalid_match_id" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (status && status !== "active" && status !== "unmatched") {
      return new Response(JSON.stringify({ error: "invalid_status" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (markOpened !== undefined && typeof markOpened !== "boolean") {
      return new Response(JSON.stringify({ error: "invalid_mark_opened" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { data: matchRow, error: matchError } = await serviceClient
      .from("user_matches")
      .select(
        "id, user_a, user_b, status, unmatched_at, unmatched_by, user_a_opened_at, user_b_opened_at"
      )
      .eq("id", matchId)
      .single();

    if (matchError || !matchRow) {
      return new Response(JSON.stringify({ error: "match_not_found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    const isUserA = matchRow.user_a === user.id;
    const isUserB = matchRow.user_b === user.id;

    if (!isUserA && !isUserB) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const updates: Record<string, any> = {};

    if (status) {
      updates.status = status;
      if (status === "unmatched") {
        updates.unmatched_at = new Date().toISOString();
        updates.unmatched_by = user.id;
      } else {
        updates.unmatched_at = null;
        updates.unmatched_by = null;
      }
    }

    if (markOpened) {
      const openedField = isUserA ? "user_a_opened_at" : "user_b_opened_at";
      if (!matchRow[openedField]) {
        updates[openedField] = new Date().toISOString();
      }
    }

    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ error: "nothing_to_update" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { data: updated, error: updateError } = await serviceClient
      .from("user_matches")
      .update(updates)
      .eq("id", matchId)
      .select(
        "id, user_a, user_b, status, matched_at, unmatched_at, unmatched_by, user_a_opened_at, user_b_opened_at, place_id"
      )
      .single();

    if (updateError || !updated) {
      return new Response(JSON.stringify({ error: "update_failed" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ match: updated }), {
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
