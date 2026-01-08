import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { sendPushNotification } from "../_shared/push-notifications.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceKey);

serve(async (req) => {
  try {
    console.log("[Place Activity Cron] Starting...");

    // 1. Get Candidates via RPC
    // This RPC handles all the complex logic:
    // - Favorites Started (>0 active)
    // - Favorites Heating (>3 active)
    // - Nearby Heating (>3 active, within 1km)
    // - Excludes users currently at the place
    // - Respects TTL (checked generally, but shared lib checks again for safety)
    const { data: candidates, error } = await supabase.rpc("get_place_activity_candidates");

    if (error) {
      console.error("RPC get_place_activity_candidates failed", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    if (!candidates || candidates.length === 0) {
      console.log("[Place Activity Cron] No notifications to send.");
      return new Response(JSON.stringify({ success: true, count: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`[Place Activity Cron] Processing ${candidates.length} candidates`);

    let sentCount = 0;

    // 2. Process Candidates
    for (const item of candidates) {
      // item = { user_id, type, place_id, place_name }
      
      let title = "";
      let body = "";

      switch (item.type) {
        case "favorite_activity_started":
          title = "Movimento começando!";
          body = `Alguém iniciou a conexão em ${item.place_name}`;
          break;
        case "favorite_activity_heating":
          title = "Tá esquentando!";
          body = `O ${item.place_name} está começando a se movimentar.`;
          break;
        case "nearby_activity_heating":
          title = "Movimentado agora";
          body = `Tem movimento rolando no ${item.place_name}`;
          break;
        default:
          continue;
      }

      const result = await sendPushNotification({
        supabase,
        userId: item.user_id,
        type: item.type,
        title,
        body,
        placeId: item.place_id,
        data: {
          place_id: item.place_id,
          place_name: item.place_name
        }
      });

      if (result.success && result.sent > 0) {
        sentCount++;
      }
    }

    console.log(`[Place Activity Cron] Verified and Sent ${sentCount} notifications`);

    return new Response(JSON.stringify({ success: true, sent: sentCount }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in handle-place-activity:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
