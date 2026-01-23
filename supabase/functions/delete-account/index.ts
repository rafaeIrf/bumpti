import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
    // Use requireAuth for consistent auth handling
    const authResult = await requireAuth(req);
    if (!authResult.success) {
      return authResult.response;
    }

    const { user } = authResult;

    // Get service role key for admin operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          error: "config_missing",
          message: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Admin client for deletion
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // WORKAROUND: Auth API deleteUser() fails with "Database error"
    // Use database function instead that deletes directly via SQL
    const { data: deleteResult, error: deleteError } = await serviceClient
      .rpc('delete_user_completely', { target_user_id: user.id });

    if (deleteError) {
      console.error("Error deleting user via RPC:", deleteError);
      return new Response(
        JSON.stringify({
          error: "delete_failed",
          message: deleteError.message,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!deleteResult?.success) {
      console.error("Database function returned error:", deleteResult);
      return new Response(
        JSON.stringify({
          error: "delete_failed",
          message: deleteResult?.error || "Failed to delete user",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Successfully deleted user:", user.id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("delete-account edge error:", error);
    return new Response(
      JSON.stringify({
        error: "internal_error",
        message: error instanceof Error ? error.message : "Unexpected error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
