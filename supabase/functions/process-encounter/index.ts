/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

/**
 * process-encounter
 *
 * Thin Edge Function triggered by pg_net webhook on user_presences checkout.
 * Delegates ALL computation to the database stored procedure
 * `calculate_and_upsert_encounters` for set-based performance.
 *
 * Payload: { record: { user_id, place_id, entered_at, ended_at } }
 */
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
    const body = await req.json();
    const record = body?.record;

    // Validate payload
    if (!record?.user_id || !record?.place_id || !record?.entered_at) {
      return new Response(
        JSON.stringify({ error: "invalid_payload", message: "Missing required fields: user_id, place_id, entered_at" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { user_id, place_id, entered_at, ended_at } = record;

    // Service client — this function is called by pg_net with service_role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Single RPC call — all logic lives in the database
    const { data, error } = await serviceClient.rpc(
      "calculate_and_upsert_encounters",
      {
        p_user_id: user_id,
        p_place_id: place_id,
        p_entered_at: entered_at,
        p_ended_at: ended_at ?? new Date().toISOString(),
      }
    );

    if (error) {
      console.error("calculate_and_upsert_encounters RPC error:", error);
      return new Response(
        JSON.stringify({ error: "rpc_error", message: error.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log(
      `process-encounter: user=${user_id} place=${place_id} upserted=${data}`
    );

    return new Response(
      JSON.stringify({ success: true, encounters_upserted: data }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: unknown) {
    const error = err as Error;
    console.error("process-encounter error:", error);
    return new Response(
      JSON.stringify({
        error: "internal_error",
        message: error?.message ?? "Unexpected error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
