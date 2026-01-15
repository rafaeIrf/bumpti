import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate GitHub Actions via custom header
    const githubToken = req.headers.get("x-github-token");
    const expectedToken = Deno.env.get("GH_HYDRATION_TOKEN");

    // Debug logging
    console.log("🔐 Token validation:", {
      hasReceivedToken: !!githubToken,
      hasExpectedToken: !!expectedToken,
      receivedLength: githubToken?.length,
      expectedLength: expectedToken?.length,
      tokensMatch: githubToken === expectedToken
    });

    if (!githubToken || githubToken !== expectedToken) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { city_id, status, error_message, stats } = await req.json();

    if (!city_id || !status) {
      return new Response(
        JSON.stringify({ error: "city_id and status required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["completed", "failed"].includes(status)) {
      return new Response(
        JSON.stringify({ error: "status must be 'completed' or 'failed'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Update cities_registry
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === "completed") {
      updateData.last_hydrated_at = new Date().toISOString();
      updateData.priority_score = 0; // Reset priority
      updateData.error_message = null;
    } else if (status === "failed") {
      updateData.error_message = error_message || "Unknown error";
    }

    const { error: updateError } = await supabase
      .from("cities_registry")
      .update(updateData)
      .eq("id", city_id);

    if (updateError) {
      throw updateError;
    }

    // Log statistics if provided
    if (stats) {
      console.log("Hydration stats for city", city_id, ":", stats);
    }

    // Optionally: Broadcast to realtime channel for app notification
    // This would notify connected apps that city data is ready
    if (status === "completed") {
      const channel = supabase.channel(`city:${city_id}`);
      channel.send({
        type: "broadcast",
        event: "hydration_complete",
        payload: { city_id, stats },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        city_id,
        status,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in finalize-city-hydration:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
