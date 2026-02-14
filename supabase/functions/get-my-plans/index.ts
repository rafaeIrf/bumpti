/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch user's active plans with place info
    const { data: plans, error } = await serviceClient
      .from("user_presences")
      .select(`
        id,
        place_id,
        planned_for,
        planned_period,
        entered_at,
        places!inner (
          name,
          category
        )
      `)
      .eq("user_id", user.id)
      .eq("entry_type", "planning")
      .eq("active", true)
      .gte("planned_for", new Date().toISOString().split("T")[0])
      .order("planned_for", { ascending: true });

    if (error) {
      console.error("Query error:", error);
      throw error;
    }

    // For each plan, get active_users count at that place
    const plansWithCounts = await Promise.all(
      (plans || []).map(async (plan: any) => {
        const { data: countData } = await serviceClient.rpc(
          "get_active_users_with_avatars",
          {
            target_place_id: plan.place_id,
            requesting_user_id: user.id,
            max_avatars: 0,
          }
        );

        return {
          id: plan.id,
          place_id: plan.place_id,
          place_name: plan.places?.name || null,
          place_category: plan.places?.category || null,
          planned_for: plan.planned_for,
          planned_period: plan.planned_period,
          active_users: countData?.count ?? 0,
        };
      })
    );

    return new Response(
      JSON.stringify({ plans: plansWithCounts }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: unknown) {
    const error = err as Error;
    console.error("getMyPlans error:", error);
    return new Response(
      JSON.stringify({
        error: "internal_error",
        message: error?.message ?? "Unexpected error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
