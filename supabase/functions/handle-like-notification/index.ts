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

    // Fetch liker info and check if both users are at the same place
    let isAtSamePlace = false;
    let likerName = "";
    
    if (interaction_id) {
      // Single query: Get interaction with liker's profile and presence
      const { data: interaction } = await supabase
        .from("user_interactions")
        .select(`
          from_user_id,
          from_user:profiles!user_interactions_from_user_id_fkey(name),
          liker_presence:user_presences!user_presences_user_id_fkey(place_id, active)
        `)
        .eq("id", interaction_id)
        .single();
      
      if (interaction) {
        likerName = interaction.from_user?.name || "";
        
        // Check same place if liker has active presence
        const likerPlaceId = interaction.liker_presence?.find((p: any) => p.active)?.place_id;
        
        if (likerPlaceId) {
          const { data: likedPresence } = await supabase
            .from("user_presences")
            .select("place_id")
            .eq("user_id", liked_user_id)
            .eq("active", true)
            .single();
          
          isAtSamePlace = likedPresence?.place_id === likerPlaceId;
        }
      }
    }

    console.log(`[Like Notification] likerName: ${likerName}, isAtSamePlace: ${isAtSamePlace}`);

    // Customize notification based on context
    const title = likerName ? `${likerName} curtiu você!` : "Você recebeu um like!";
    const body = isAtSamePlace 
      ? "Essa pessoa está aqui no local com você. Veja quem é!" 
      : "Confira quem está na sua sintonia e prepare o próximo encontro.";

    // Send push notification
    const result = await sendPushNotification({
      supabase,
      userId: liked_user_id,
      type: "like_received",
      title,
      body,
      data: {
        type: "like_received",
        interaction_id: interaction_id || "",
        is_at_same_place: isAtSamePlace ? "true" : "false",
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
