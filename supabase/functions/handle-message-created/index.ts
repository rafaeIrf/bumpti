import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { sendPushNotification } from "../_shared/push-notifications.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceKey);

serve(async (req) => {
  try {
    const payload = await req.json();
    const message = payload.record;

    if (!message || !message.chat_id || !message.sender_id) {
      console.error("Invalid message payload", payload);
      return new Response("Invalid Payload", { status: 400 });
    }

    console.log(`[Message Hook] Processing message ${message.id} from ${message.sender_id}`);

    // 1. Get Chat -> Match -> Participants
    // We need to find who is the recipient
    const { data: chat, error: chatError } = await supabase
      .from("chats")
      .select("match_id")
      .eq("id", message.chat_id)
      .single();

    if (chatError || !chat) {
      console.error("Chat lookup failed", chatError);
      return new Response("Chat not found", { status: 404 });
    }

    const { data: match, error: matchError } = await supabase
      .from("user_matches")
      .select("user_a, user_b")
      .eq("id", chat.match_id)
      .single();

    if (matchError || !match) {
      console.error("Match lookup failed", matchError);
      return new Response("Match not found", { status: 404 });
    }

    // Identify recipient
    const recipientId = match.user_a === message.sender_id ? match.user_b : match.user_a;

    // 2. Get Sender Profile (for Name)
    const { data: sender } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", message.sender_id)
      .single();

    const senderName = sender?.name || "Alguém";

    // 3. Send Push
    await sendPushNotification({
      supabase,
      userId: recipientId,
      type: "message_received",
      title: "Nova mensagem",
      body: `Você recebeu uma mensagem de ${senderName}`,
      data: {
        chat_id: message.chat_id,
        match_id: chat.match_id,
        sender_id: message.sender_id
      }
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in handle-message-created:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
