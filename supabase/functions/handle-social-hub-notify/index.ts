import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { sendPushNotification } from "../_shared/push-notifications.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceKey);

serve(async (req) => {
  try {
    const { record } = await req.json();

    if (!record?.user_id || !record?.place_id) {
      console.error("[SocialHubNotify] Missing user_id or place_id");
      return new Response(JSON.stringify({ error: "missing_fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const authorId = record.user_id;
    const placeId = record.place_id;

    console.log(`[SocialHubNotify] Processing: author=${authorId}, place=${placeId}`);

    // 1. Get author name
    const { data: author } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", authorId)
      .single();

    if (!author?.name) {
      console.log("[SocialHubNotify] Author profile not found, skipping");
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Get place info
    const { data: place } = await supabase
      .from("places")
      .select("name, lat, lng")
      .eq("id", placeId)
      .single();

    if (!place?.name) {
      console.log("[SocialHubNotify] Place not found, skipping");
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 3. Find eligible targets via dedicated RPC (queries profile_social_hubs)
    const { data: targets, error: targetsError } = await supabase.rpc(
      "get_social_hub_targets",
      {
        p_author_id: authorId,
        p_place_id: placeId,
      }
    );

    if (targetsError) {
      console.error("[SocialHubNotify] RPC error:", targetsError);
      return new Response(JSON.stringify({ error: targetsError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!targets || targets.length === 0) {
      console.log("[SocialHubNotify] No eligible targets");
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`[SocialHubNotify] Found ${targets.length} eligible targets`);

    // 4. Send push to each target
    let sentCount = 0;

    for (const target of targets) {
      const result = await sendPushNotification({
        supabase,
        userId: target.target_user_id,
        type: "social_hub_new_regular",
        title: "Vocês frequentam o mesmo hub! 🤝",
        body: `${author.name} também curte ${place.name}. Que tal se conectar?`,
        placeId,
        data: {
          place_id: placeId,
          place_name: place.name,
          place_lat: String(place.lat),
          place_lng: String(place.lng),
          author_name: author.name,
        },
      });

      if (result.success && result.sent > 0) {
        sentCount++;
      }
    }

    console.log(`[SocialHubNotify] Sent ${sentCount} notifications`);

    return new Response(JSON.stringify({ success: true, sent: sentCount }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[SocialHubNotify] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
