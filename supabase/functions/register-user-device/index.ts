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

    // Validate user ID (should never happen if requireAuth succeeds, but good to check)
    if (!userId) {
      console.error("User ID is undefined after auth:", { user });
      return new Response(
        JSON.stringify({ error: "Invalid user authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { fcm_token, platform } = await req.json();

    // Validate input
    if (!fcm_token || typeof fcm_token !== "string") {
      return new Response(
        JSON.stringify({ error: "fcm_token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!platform || !["ios", "android"].includes(platform)) {
      return new Response(
        JSON.stringify({ error: "platform must be 'ios' or 'android'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role for database operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();

    // Step 1: Deactivate this token for any OTHER user
    const { error: deactivateError } = await supabase
      .from("user_devices")
      .update({ active: false, last_active_at: now })
      .eq("fcm_token", fcm_token)
      .neq("user_id", userId);

    if (deactivateError) {
      console.error("Error deactivating old tokens:", deactivateError);
    }

    // Step 2: Use UPSERT to handle token registration
    // The UNIQUE constraint on fcm_token ensures no duplicates
    // If token exists, it updates to new user_id and reactivates
    // If token is new, it inserts a new record
    const { error: upsertError } = await supabase
      .from("user_devices")
      .upsert(
        {
          fcm_token,
          user_id: userId,
          platform,
          active: true,
          last_active_at: now,
        },
        {
          onConflict: "fcm_token",
          ignoreDuplicates: false, // Update existing record instead of ignoring
        }
      );

    if (upsertError) {
      console.error("Error upserting device:", upsertError);
      return new Response(
        JSON.stringify({ error: "Failed to register device" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Device registered successfully for user ${userId}`);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in register-user-device:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const status = errorMessage.includes("Authorization") || errorMessage.includes("token") ? 401 : 500;

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
