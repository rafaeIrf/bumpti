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

interface EnterPlaceRequest {
  place_id: string;
  userLat?: number;
  userLng?: number;
  is_checkin_plus?: boolean;
}

interface EnterPlaceV2Result {
  status: 'created' | 'refreshed' | 'rejected';
  presence?: Record<string, unknown>;
  error?: string;
  inside_boundary?: boolean;
  remaining_credits?: number;
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
    // Auth check + body parsing in parallel
    const [authResult, body] = await Promise.all([
      requireAuth(req),
      req.json().catch(() => null) as Promise<EnterPlaceRequest | null>,
    ]);

    if (!authResult.success) {
      return authResult.response;
    }

    const { user } = authResult;

    // Validate request body
    if (!body?.place_id || typeof body.place_id !== "string") {
      return new Response(JSON.stringify({ error: "invalid_place_id" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { place_id, userLat, userLng, is_checkin_plus } = body;

    // Create service client for the unified RPC
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Single RPC call handles everything:
    // - Boundary intersection check
    // - Existing presence refresh OR new presence insert
    // - Credit decrement (if checkin_plus)
    const { data: result, error: rpcError } = await serviceClient.rpc<EnterPlaceV2Result>(
      "enter_place",
      {
        p_user_id: user.id,
        p_place_id: place_id,
        p_user_lat: typeof userLat === "number" ? userLat : null,
        p_user_lng: typeof userLng === "number" ? userLng : null,
        p_is_checkin_plus: is_checkin_plus === true,
      }
    );

    if (rpcError) {
      console.error("enter_place RPC error:", rpcError);
      throw rpcError;
    }

    // Handle rejection (outside boundary without checkin_plus)
    if (result?.status === "rejected") {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Success response
    const httpStatus = result?.status === "created" ? 201 : 200;
    
    return new Response(
      JSON.stringify({
        presence: result?.presence,
        remaining_credits: result?.remaining_credits,
      }),
      { status: httpStatus, headers: corsHeaders }
    );
  } catch (err: unknown) {
    const error = err as Error;
    console.error("enterPlace error:", error);
    return new Response(
      JSON.stringify({
        error: "internal_error",
        message: error?.message ?? "Unexpected error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
