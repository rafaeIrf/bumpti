/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { requireAuth } from "../_shared/auth.ts";

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
    const authResult = await requireAuth(req);
    if (!authResult.success) {
      return authResult.response;
    }

    const { user } = authResult;

    // Parse body for user location
    const body = await req.json().catch(() => ({}));
    const lat = parseFloat(body.lat || "0");
    const lng = parseFloat(body.lng || "0");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Call the RPC — all spatial filtering happens server-side via ST_DWithin
    const { data: rows, error } = await serviceClient.rpc(
      "get_suggested_plans",
      {
        user_lat: lat,
        user_lng: lng,
        radius_meters: 50000,
        requesting_user_id: user.id,
      }
    );

    if (error) {
      console.error("RPC error:", error);
      throw error;
    }

    const suggestions = (rows || []).map((r: any) => ({
      place_id: r.place_id,
      name: r.name,
      category: r.category || "",
      latitude: r.lat || 0,
      longitude: r.lng || 0,
      plan_count: r.plan_count,
      distance: Math.round(r.dist_meters || 0),
    }));

    // total_unique_users is the same on every row
    const totalCount = rows?.[0]?.total_unique_users ?? 0;

    return new Response(
      JSON.stringify({ suggestions, total_count: totalCount }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: unknown) {
    const error = err as Error;
    console.error("getSuggestedPlans error:", error);
    return new Response(
      JSON.stringify({
        error: "internal_error",
        message: error?.message ?? "Unexpected error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
