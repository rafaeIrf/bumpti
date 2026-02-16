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
      // item = { target_user_id, notification_type, target_place_id, target_place_name, active_count, has_planning }
      
      let title = "";
      let body = "";
      const count = item.active_count || 0;
      const isPlanning = item.has_planning === true;

      switch (item.notification_type) {
        case "favorite_activity_started":
          if (isPlanning) {
            title = "Seu pico está movimentado! 📍";
            body = `Pessoas estão planejando ir em ${item.target_place_name}. Planeje também e conecte-se antes!`;
          } else {
            title = "Conexão no seu pico! 📍";
            body = `${count === 1 ? 'Alguém' : count + ' pessoas'} ${count === 1 ? 'iniciou' : 'iniciaram'} check-in em ${item.target_place_name}. Faça também e conecte-se!`;
          }
          break;
        case "favorite_activity_heating":
          if (isPlanning) {
            title = `${item.target_place_name} está esquentando 🔥`;
            body = `Pessoas estão planejando ir e iniciando conexões. Não fique de fora!`;
          } else {
            title = `${item.target_place_name} está bombando 🔥`;
            body = `${count} ${count === 1 ? 'pessoa' : 'pessoas'} já ${count === 1 ? 'fez' : 'fizeram'} check-in. Faça também e conecte-se!`;
          }
          break;
        case "nearby_activity_started":
          if (isPlanning) {
            title = "Atividade perto de você! 📍";
            body = `Pessoas estão planejando ir em ${item.target_place_name}. Planeje também!`;
          } else {
            title = "Conexão próxima! 📍";
            body = `${count === 1 ? 'Alguém' : count + ' pessoas'} ${count === 1 ? 'fez' : 'fizeram'} check-in em ${item.target_place_name}. Faça também e conecte-se!`;
          }
          break;
        case "nearby_activity_heating":
          if (isPlanning) {
            title = `${item.target_place_name} está esquentando 🔥`;
            body = `Pessoas estão planejando ir e iniciando conexões!`;
          } else {
            title = `${item.target_place_name} está bombando 🔥`;
            body = `${count} ${count === 1 ? 'pessoa' : 'pessoas'} ${count === 1 ? 'fez' : 'fizeram'} check-in. Faça também e conecte-se!`;
          }
          break;
        default:
          continue;
      }

      const result = await sendPushNotification({
        supabase,
        userId: item.target_user_id,
        type: item.notification_type,
        title,
        body,
        placeId: item.target_place_id,
        data: {
          place_id: item.target_place_id,
          place_name: item.target_place_name,
          place_lat: String(item.target_place_lat),
          place_lng: String(item.target_place_lng),
          has_planning: String(item.has_planning === true),
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
