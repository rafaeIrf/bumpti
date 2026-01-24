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
    // Authenticate user
    const authResult = await requireAuth(req);
    if (!authResult.success) {
      return authResult.response;
    }
    const { user } = authResult;

    // Get service role client for database operations
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceClient = supabaseServiceKey && supabaseUrl
      ? createClient(supabaseUrl, supabaseServiceKey)
      : null;
    const dbClient = serviceClient || authResult.supabase;

    if (!serviceClient) {
      console.warn(
        "report-place: SUPABASE_SERVICE_ROLE_KEY not set, falling back to auth client (RLS must allow insert)."
      );
    }

    const body = await req.json().catch(() => null);
    const placeId = body?.place_id;
    const reason =
      typeof body?.reason === "string" ? body.reason.trim() : undefined;
    const description =
      typeof body?.description === "string"
        ? body.description.trim()
        : undefined;

    if (!placeId || typeof placeId !== "string") {
      return new Response(JSON.stringify({ error: "invalid_place_id" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (!reason) {
      return new Response(JSON.stringify({ error: "invalid_reason" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Validate reason is one of the allowed values
    const validReasons = [
      "closed",
      "wrong_info",
      "does_not_exist",
      "inappropriate",
      "other",
    ];
    if (!validReasons.includes(reason)) {
      return new Response(JSON.stringify({ error: "invalid_reason_value" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (description && description.length > 500) {
      return new Response(
        JSON.stringify({ error: "description_too_long", max: 500 }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { data: report, error: insertError } = await dbClient
      .from("place_reports")
      .insert({
        place_id: placeId,
        user_id: user.id,
        reason,
        description: description || null,
      })
      .select("id")
      .single();

    if (insertError || !report?.id) {
      console.error("report-place insert error:", insertError, {
        usingServiceKey: Boolean(serviceClient),
      });
      return new Response(
        JSON.stringify({
          error: "report_failed",
          message: "Unable to save report",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ status: "ok", report_id: report.id }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error("report-place edge error:", err);
    return new Response(
      JSON.stringify({
        error: "internal_error",
        message: err instanceof Error ? err.message : "Unexpected error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
