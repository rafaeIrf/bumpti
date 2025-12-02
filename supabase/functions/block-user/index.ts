/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({
          error: "config_missing",
          message: "Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars",
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (!supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          error: "config_missing",
          message: "Missing SUPABASE_SERVICE_ROLE_KEY env var",
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user?.id) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const body = await req.json().catch(() => null);
    const blockedUserId = body?.blocked_user_id;

    if (!blockedUserId || typeof blockedUserId !== "string") {
      return new Response(JSON.stringify({ error: "invalid_blocked_user" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (blockedUserId === user.id) {
      return new Response(JSON.stringify({ error: "cannot_block_self" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Insert block record
    const { error: insertError } = await serviceClient
      .from("user_blocks")
      .upsert(
        {
          blocker_id: user.id,
          blocked_id: blockedUserId,
        },
        { onConflict: "blocker_id,blocked_id" }
      );

    if (insertError) {
      console.error("block-user insert error:", insertError);
      return new Response(
        JSON.stringify({
          error: "block_failed",
          message: "Unable to block user",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Unmatch any active match between blocker and blocked user
    const now = new Date().toISOString();
    const { error: unmatchError } = await serviceClient
      .from("user_matches")
      .update({
        status: "unmatched",
        unmatched_at: now,
        unmatched_by: user.id,
      })
      .eq("status", "active")
      .or(
        `and(user_a.eq.${user.id},user_b.eq.${blockedUserId}),and(user_a.eq.${blockedUserId},user_b.eq.${user.id})`
      );

    if (unmatchError) {
      console.error("block-user unmatch error:", unmatchError);
      // Continue even if unmatch fails - block is more important
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err) {
    console.error("block-user edge error:", err);
    return new Response(
      JSON.stringify({
        error: "internal_error",
        message: err instanceof Error ? err.message : "Unexpected error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
