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

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const serviceClient = supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey)
      : null;
    const dbClient = serviceClient || authClient;
    if (!serviceClient) {
      console.warn(
        "interact-user: SUPABASE_SERVICE_ROLE_KEY not set, falling back to anon client with RLS"
      );
    }

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
    const toUserId = body?.to_user_id;
    const action = body?.action;
    const placeId = body?.place_id;

    if (!toUserId || typeof toUserId !== "string") {
      return new Response(JSON.stringify({ error: "invalid_to_user_id" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (!placeId || typeof placeId !== "string") {
      return new Response(JSON.stringify({ error: "invalid_place_id" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (toUserId === user.id) {
      return new Response(JSON.stringify({ error: "cannot_interact_with_self" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (action !== "like" && action !== "dislike") {
      return new Response(JSON.stringify({ error: "invalid_action" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (action === "like") {
      // Check if there is an existing pending like from the target user (Like Back scenario)
      // If there is a pending like, we allow the interaction even if the current user is not at the place
      const { data: incomingLike, error: incomingLikeError } = await dbClient
        .from("user_interactions")
        .select("id")
        .eq("from_user_id", toUserId)
        .eq("to_user_id", user.id)
        .eq("action", "like")
        .gt("action_expires_at", new Date().toISOString())
        .maybeSingle();

      if (incomingLikeError) {
         console.error("Error checking incoming like:", incomingLikeError);
         // Continue to presence check if this fails, or strict fail? 
         // Safest to continue to presence check, but let's just log it.
      }

      // Only enforce presence if this is NOT a response to an existing like
      if (!incomingLike) {
        const { data: activePresence, error: presenceError } = await dbClient
          .from("user_presences")
          .select("id")
          .eq("user_id", user.id)
          .eq("place_id", placeId)
          .eq("active", true)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();

        if (presenceError) {
          return new Response(
            JSON.stringify({ error: "place_lookup_failed", message: presenceError.message }),
            { status: 400, headers: corsHeaders }
          );
        }

        if (!activePresence) {
          return new Response(JSON.stringify({ error: "place_not_active_for_user" }), {
            status: 400,
            headers: corsHeaders,
          });
        }
      }

      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const { error: likeError } = await dbClient
        .from("user_interactions")
        .upsert(
          {
            from_user_id: user.id,
            to_user_id: toUserId,
            action: "like",
            action_expires_at: expiresAt,
            place_id: placeId,
          },
          {
            onConflict: "from_user_id,to_user_id",
            ignoreDuplicates: false,
          }
        );

      if (likeError) {
        return new Response(JSON.stringify({ error: "like_failed", message: likeError.message }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const { data: matchRow, error: matchError } = await dbClient
        .from("user_matches")
        .select("id")
        .eq("status", "matched")
        .or(
          `and(user_a.eq.${user.id},user_b.eq.${toUserId}),and(user_a.eq.${toUserId},user_b.eq.${user.id})`
        )
        .maybeSingle();

      if (matchError) {
        return new Response(JSON.stringify({ error: "match_check_failed", message: matchError.message }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      return new Response(
        JSON.stringify({
          status: "liked",
          match: Boolean(matchRow),
          match_id: matchRow?.id ?? null,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    const { error: dislikeError } = await dbClient
      .from("user_interactions")
      .upsert(
        {
          from_user_id: user.id,
          to_user_id: toUserId,
          action: "dislike",
          action_expires_at: null,
          place_id: placeId,
        },
        {
          onConflict: "from_user_id,to_user_id",
          ignoreDuplicates: false,
        }
      );

    if (dislikeError) {
      return new Response(
        JSON.stringify({ error: "dislike_failed", message: dislikeError.message }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { data: existingMatch, error: matchLookupError } = await dbClient
      .from("user_matches")
      .select("id,status")
      .or(
        `and(user_a.eq.${user.id},user_b.eq.${toUserId}),and(user_a.eq.${toUserId},user_b.eq.${user.id})`
      )
      .eq("status", "matched")
      .maybeSingle();

    if (matchLookupError) {
      return new Response(
        JSON.stringify({ error: "match_lookup_failed", message: matchLookupError.message }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (existingMatch?.id) {
      const { error: unmatchError } = await dbClient
        .from("user_matches")
        .update({ status: "unmatched", unmatched_at: new Date().toISOString() })
        .eq("id", existingMatch.id);

      if (unmatchError) {
        return new Response(
          JSON.stringify({ error: "unmatch_failed", message: unmatchError.message }),
          { status: 400, headers: corsHeaders }
        );
      }
    }

    return new Response(JSON.stringify({ status: "disliked" }), {
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
