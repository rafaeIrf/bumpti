import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { signUserAvatars } from "../_shared/signPhotoUrls.ts";

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
        JSON.stringify({ error: "config_missing" }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Validate user identity via auth client
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

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
    const placeId = body?.place_id;

    if (!placeId || typeof placeId !== "string") {
      return new Response(JSON.stringify({ error: "invalid_place_id" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Use service role client for elevated DB access + storage signing
    const dbClient = supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey)
      : authClient;

    // Pass requesting_user_id: null → raw social proof counts (no is_eligible_match filtering).
    // The map is social proof context (not personalized matching), consistent with
    // how get_map_active_places calls get_place_social_summary(place_id, NULL).
    const { data, error } = await dbClient.rpc("get_place_social_summary", {
      target_place_id: placeId,
      requesting_user_id: user.id,
    });

    if (error) {
      console.error("[place-social-summary] RPC error:", error);
      return new Response(
        JSON.stringify({ error: "rpc_failed", message: error.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Sign avatar URLs — RPC returns storage paths, not public/signed URLs
    const rawAvatars: { user_id: string; url: string; entry_type?: string }[] = data?.avatars ?? [];
    const signedAvatars = await signUserAvatars(dbClient, rawAvatars);

    const result = {
      active_count: data?.active_count ?? 0,
      planning_count: data?.planning_count ?? 0,
      regulars_count: data?.regulars_count ?? 0,
      avatars: signedAvatars,
    };

    return new Response(JSON.stringify(result), {
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
