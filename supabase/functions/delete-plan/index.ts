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

interface DeletePlanRequest {
  plan_id: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
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
    const [authResult, body] = await Promise.all([
      requireAuth(req),
      req.json().catch(() => null) as Promise<DeletePlanRequest | null>,
    ]);

    if (!authResult.success) {
      return authResult.response;
    }

    const { user } = authResult;

    // ── Validate request body ────────────────────────────────────────
    if (!body?.plan_id || typeof body.plan_id !== "string") {
      return new Response(JSON.stringify({ error: "invalid_plan_id" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { plan_id } = body;

    // ── Create service client ────────────────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // ── Verify plan exists, belongs to user, and is active ───────────
    const { data: plan, error: planError } = await serviceClient
      .from("user_presences")
      .select("id, user_id")
      .eq("id", plan_id)
      .eq("user_id", user.id)
      .eq("entry_type", "planning")
      .eq("active", true)
      .maybeSingle();

    if (planError) {
      console.error("Plan lookup error:", planError);
      throw planError;
    }

    if (!plan) {
      return new Response(JSON.stringify({ error: "plan_not_found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    // ── Soft-delete: set active = false, ended_at = now ──────────────
    const { error: updateError } = await serviceClient
      .from("user_presences")
      .update({
        active: false,
        ended_at: new Date().toISOString(),
      })
      .eq("id", plan_id)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Delete plan error:", updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: unknown) {
    const error = err as Error;
    console.error("deletePlan error:", error);
    return new Response(
      JSON.stringify({
        error: "internal_error",
        message: error?.message ?? "Unexpected error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
