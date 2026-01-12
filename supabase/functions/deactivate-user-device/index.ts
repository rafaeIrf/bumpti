import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate user from JWT
    const { user } = await requireAuth(req);
    const userId = user.id;

    // Parse request body
    const { fcm_token } = await req.json();

    // Validate input
    if (!fcm_token || typeof fcm_token !== "string") {
      return new Response(
        JSON.stringify({ error: "fcm_token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role for database operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();

    // Deactivate the token for this user
    const { error: updateError } = await supabase
      .from("user_devices")
      .update({ active: false, last_active_at: now })
      .eq("fcm_token", fcm_token)
      .eq("user_id", userId);

    if (updateError) {
      console.error("Error deactivating device:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to deactivate device" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Device deactivated for user ${userId}`);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in deactivate-user-device:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const status = errorMessage.includes("Authorization") || errorMessage.includes("token") ? 401 : 500;

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
