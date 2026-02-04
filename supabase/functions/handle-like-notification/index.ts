import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { corsHeaders } from "../_shared/cors.ts";
import { sendPushNotification } from "../_shared/push-notifications.ts";

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse request body
    const { liked_user_id, interaction_id } = await req.json();

    if (!liked_user_id) {
      return new Response(
        JSON.stringify({ error: "Missing liked_user_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase Service Role client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[Like Notification] Processing for user ${liked_user_id}, interaction ${interaction_id}`);

    // Send push notification
    // Note: We don't reveal who liked them - just a generic "you have a new like"
    const result = await sendPushNotification({
      supabase,
      userId: liked_user_id,
      type: "like_received",
      title: "Você recebeu um like!",
      body: "Alguém curtiu você. Confira no app!",
      data: {
        type: "like_received",
        interaction_id: interaction_id || "",
      },
    });

    console.log(`[Like Notification] Result:`, result);

    return new Response(
      JSON.stringify({ success: true, result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Like Notification] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
