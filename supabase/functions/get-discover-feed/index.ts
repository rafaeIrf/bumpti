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

    // Authenticated client (user context for RLS)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const userId = user.id;

    // 1. Check recent presence (7-day window)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: presenceData, error: presenceError } = await supabase
      .from("user_presences")
      .select("id")
      .eq("user_id", userId)
      .gte("entered_at", sevenDaysAgo.toISOString())
      .limit(1);

    if (presenceError) {
      console.error("[get-discover-feed] presenceError:", presenceError);
    }

    const hasRecentPresence = (presenceData?.length ?? 0) > 0;

    // 2. If no recent presence, return early (empty feed)
    if (!hasRecentPresence) {
      return new Response(
        JSON.stringify({
          has_recent_presence: false,
          feed: {
            direct_overlap: [],
            vibe_match: [],
            path_match: [],
          },
        }),
        { headers: corsHeaders }
      );
    }

    // 3. Fetch discover feed via RPC
    const { data: encounters, error: feedError } = await supabase.rpc(
      "get_discover_feed",
      { p_viewer_id: userId }
    );

    if (feedError) {
      console.error("[get-discover-feed] RPC error:", feedError);
      return new Response(
        JSON.stringify({
          error: "feed_error",
          message: feedError.message,
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // 4. Categorize encounters
    const feed = {
      direct_overlap: [] as any[],
      vibe_match: [] as any[],
      path_match: [] as any[],
    };

    for (const encounter of encounters ?? []) {
      if (encounter.encounter_type === "direct_overlap") {
        feed.direct_overlap.push(encounter);
      } else if (encounter.encounter_type === "vibe_match") {
        feed.vibe_match.push(encounter);
      } else {
        // path_match + routine_match → group under path_match
        feed.path_match.push(encounter);
      }
    }

    return new Response(
      JSON.stringify({
        has_recent_presence: true,
        feed,
      }),
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("[get-discover-feed] Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: "internal_error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
