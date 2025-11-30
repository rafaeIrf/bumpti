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

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars");
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

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

    const body = await req.json().catch(() => null);
    const otherUserId = body?.user_id;

    if (!otherUserId || typeof otherUserId !== "string") {
      return new Response(JSON.stringify({ error: "invalid_user_id" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const userA = [user.id, otherUserId].sort()[0];
    const userB = [user.id, otherUserId].sort()[1];

    const { data: matchRow, error: matchError } = await supabase
      .from("user_matches")
      .select("id, status")
      .eq("user_a", userA)
      .eq("user_b", userB)
      .eq("status", "matched")
      .maybeSingle();

    if (matchError) {
      return new Response(
        JSON.stringify({ error: "match_lookup_failed", message: matchError.message }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!matchRow?.id) {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    const { error: updateError } = await supabase
      .from("user_matches")
      .update({ status: "unmatched", unmatched_at: new Date().toISOString() })
      .eq("id", matchRow.id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "unmatch_failed", message: updateError.message }),
        { status: 400, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ status: "unmatched", match_id: matchRow.id }),
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
