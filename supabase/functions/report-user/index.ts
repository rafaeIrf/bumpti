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
          message:
            "Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars",
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Authed client for user identity
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const serviceClient = supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey)
      : null;
    const dbClient = serviceClient || supabase;

    if (!serviceClient) {
      console.warn(
        "report-user: SUPABASE_SERVICE_ROLE_KEY not set, falling back to auth client (RLS must allow insert)."
      );
    }

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
    const reportedUserId = body?.reported_user_id;
    const category =
      typeof body?.category === "string" ? body.category.trim() || null : null;
    const reason =
      typeof body?.reason === "string" ? body.reason.trim() : undefined;

    if (!reportedUserId || typeof reportedUserId !== "string") {
      return new Response(JSON.stringify({ error: "invalid_reported_user" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (reportedUserId === user.id) {
      return new Response(JSON.stringify({ error: "cannot_report_self" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (!reason || reason.length === 0) {
      return new Response(JSON.stringify({ error: "invalid_reason" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (reason.length > 500) {
      return new Response(
        JSON.stringify({ error: "reason_too_long", max: 500 }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { data: report, error: insertError } = await dbClient
      .from("user_reports")
      .insert({
        reporter_id: user.id,
        reported_id: reportedUserId,
        category,
        reason,
      })
      .select("id")
      .single();

    if (insertError || !report?.id) {
      console.error("report-user insert error:", insertError, {
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
    console.error("report-user edge error:", err);
    return new Response(
      JSON.stringify({
        error: "internal_error",
        message: err instanceof Error ? err.message : "Unexpected error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
