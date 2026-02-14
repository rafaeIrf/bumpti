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

interface CreatePlanRequest {
  place_id: string;
  planned_for: "today" | "tomorrow";
  planned_period: "morning" | "afternoon" | "night";
}

const VALID_PERIODS = ["morning", "afternoon", "night"];

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
    // Auth check + body parsing in parallel
    const [authResult, body] = await Promise.all([
      requireAuth(req),
      req.json().catch(() => null) as Promise<CreatePlanRequest | null>,
    ]);

    if (!authResult.success) {
      return authResult.response;
    }

    const { user } = authResult;

    // ── Validate request body ────────────────────────────────────────
    if (!body?.place_id || typeof body.place_id !== "string") {
      return new Response(JSON.stringify({ error: "invalid_place_id" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (!body.planned_for || !["today", "tomorrow"].includes(body.planned_for)) {
      return new Response(JSON.stringify({ error: "invalid_planned_for", message: "Must be 'today' or 'tomorrow'" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (!body.planned_period || !VALID_PERIODS.includes(body.planned_period)) {
      return new Response(JSON.stringify({ error: "invalid_planned_period", message: `Must be one of: ${VALID_PERIODS.join(", ")}` }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { place_id, planned_for, planned_period } = body;

    // ── Create service client ────────────────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // ── Check daily plan limit ────────────────────────────────────────
    const today = new Date().toISOString().split("T")[0];
    
    // Count today's plans
    const { count: todayPlansCount, error: countError } = await serviceClient
      .from("user_presences")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("entry_type", "planning")
      .eq("planned_for", today)
      .eq("active", true);

    if (countError) {
      console.error("Count plans error:", countError);
      throw countError;
    }

    // Fetch user's premium status
    const { data: subscription } = await serviceClient
      .from("user_subscriptions")
      .select("status, expires_at")
      .eq("user_id", user.id)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    const isPremium = !!subscription;
    const dailyLimit = isPremium ? 10 : 2;
    const currentCount = todayPlansCount ?? 0;

    if (currentCount >= dailyLimit) {
      return new Response(
        JSON.stringify({
          error: "daily_plan_limit_reached",
          limit: dailyLimit,
          current: currentCount,
        }),
        { status: 403, headers: corsHeaders }
      );
    }


    // ── Validate place exists and is active ───────────────────────────
    const { data: place, error: placeError } = await serviceClient
      .from("places")
      .select("id")
      .eq("id", place_id)
      .eq("active", true)
      .maybeSingle();

    if (placeError) {
      console.error("Place lookup error:", placeError);
      throw placeError;
    }

    if (!place) {
      return new Response(JSON.stringify({ error: "place_not_found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    // ── Compute planned_for date ─────────────────────────────────────
    const now = new Date();
    const targetDate = new Date(now);
    if (planned_for === "tomorrow") {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    // Format as YYYY-MM-DD for DATE column
    const plannedForDate = targetDate.toISOString().split("T")[0];

    // ── Compute expires_at (end of the planned day) ──────────────────
    const expiresAt = new Date(targetDate);
    expiresAt.setHours(23, 59, 59, 999);

    // ── Upsert presence ──────────────────────────────────────────────
    // Check for existing active plan for same user+place+day
    const { data: existingPlan } = await serviceClient
      .from("user_presences")
      .select("id")
      .eq("user_id", user.id)
      .eq("place_id", place_id)
      .eq("entry_type", "planning")
      .eq("planned_for", plannedForDate)
      .eq("active", true)
      .maybeSingle();

    let presence;
    let httpStatus: number;

    if (existingPlan) {
      // Update existing plan (change period/expiration)
      const { data: updated, error: updateError } = await serviceClient
        .from("user_presences")
        .update({
          planned_period,
          expires_at: expiresAt.toISOString(),
        })
        .eq("id", existingPlan.id)
        .select()
        .single();

      if (updateError) {
        console.error("Update plan error:", updateError);
        throw updateError;
      }

      presence = updated;
      httpStatus = 200;
    } else {
      // Create new plan
      const { data: created, error: insertError } = await serviceClient
        .from("user_presences")
        .insert({
          user_id: user.id,
          place_id,
          active: true,
          entry_type: "planning",
          planned_for: plannedForDate,
          planned_period,
          expires_at: expiresAt.toISOString(),
          lat: null,
          lng: null,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Insert plan error:", insertError);
        throw insertError;
      }

      presence = created;
      httpStatus = 201;
    }

    return new Response(
      JSON.stringify({ presence }),
      { status: httpStatus, headers: corsHeaders }
    );
  } catch (err: unknown) {
    const error = err as Error;
    console.error("createPlan error:", error);
    return new Response(
      JSON.stringify({
        error: "internal_error",
        message: error?.message ?? "Unexpected error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
