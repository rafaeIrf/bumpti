import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { sendPushNotification } from "../_shared/push-notifications.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceKey);

serve(async (req) => {
  try {
    const payload = await req.json();
    const match = payload.record;

    if (!match || !match.user_a || !match.user_b) {
      console.error("Invalid match payload", payload);
      return new Response("Invalid Payload", { status: 400 });
    }

    console.log(`[Match Hook] Processing match ${match.id}`);

    // For a new match, we notify BOTH users.
    // User A needs to know they matched with User B
    // User B needs to know they matched with User A

    // 1. Get User Names
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", [match.user_a, match.user_b]);

    const userAMap = profiles?.find((p) => p.id === match.user_a);
    const userBMap = profiles?.find((p) => p.id === match.user_b);
    
    const nameA = userAMap?.name || "Alguém";
    const nameB = userBMap?.name || "Alguém";

    // 2. Notify User A
    await sendPushNotification({
      supabase,
      userId: match.user_a,
      type: "match_created",
      title: "Novo Match! 🎉",
      body: `Você deu match com ${nameB}`,
      data: {
        match_id: match.id,
        opponent_id: match.user_b
      }
    });

    // 3. Notify User B
    await sendPushNotification({
      supabase,
      userId: match.user_b,
      type: "match_created",
      title: "Novo Match! 🎉",
      body: `Você deu match com ${nameA}`,
      data: {
        match_id: match.id,
        opponent_id: match.user_a
      }
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in handle-match-created:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
