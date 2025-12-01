/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { encryptMessage, getEncryptionKey } from "../_shared/encryption.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({
          error: "config_missing",
          message: "Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars",
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const body = await req.json().catch(() => null);
    const toUserId = body?.to_user_id;
    const content =
      typeof body?.content === "string" ? body.content.trim() : "";

    if (!toUserId || typeof toUserId !== "string") {
      return new Response(JSON.stringify({ error: "invalid_to_user_id" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (!content) {
      return new Response(JSON.stringify({ error: "invalid_content" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (toUserId === user.id) {
      return new Response(JSON.stringify({ error: "cannot_message_self" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const [userA, userB] =
      user.id < toUserId ? [user.id, toUserId] : [toUserId, user.id];

    const { data: match, error: matchError } = await supabase
      .from("user_matches")
      .select("id")
      .eq("user_a", userA)
      .eq("user_b", userB)
      .eq("status", "active")
      .maybeSingle();

    if (matchError) {
      return new Response(
        JSON.stringify({
          error: "match_lookup_failed",
          message: matchError.message,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!match?.id) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const { data: existingChat, error: chatFetchError } = await supabase
      .from("chats")
      .select("id, match_id, created_at")
      .eq("match_id", match.id)
      .limit(1)
      .maybeSingle();

    if (chatFetchError) {
      return new Response(
        JSON.stringify({
          error: "chat_lookup_failed",
          message: chatFetchError.message,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    let chatId = existingChat?.id;

    if (!chatId) {
      const { data: newChat, error: chatCreateError } = await supabase
        .from("chats")
        .insert({ match_id: match.id })
        .select("id")
        .single();

      if (chatCreateError || !newChat?.id) {
        return new Response(
          JSON.stringify({
            error: "chat_create_failed",
            message: chatCreateError?.message ?? "Unable to create chat",
          }),
          { status: 400, headers: corsHeaders }
        );
      }

      chatId = newChat.id;
    }

    // Get encryption key from secrets
    const encryptionKey = await getEncryptionKey();
    if (!encryptionKey) {
      return new Response(
        JSON.stringify({
          error: "encryption_failed",
          message: "Unable to retrieve encryption key",
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Encrypt the message content
    const encrypted = await encryptMessage(content, encryptionKey);
    if (!encrypted) {
      return new Response(
        JSON.stringify({
          error: "encryption_failed",
          message: "Unable to encrypt message",
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Save encrypted message to database
    const { data: message, error: messageError } = await supabase
      .from("messages")
      .insert({
        chat_id: chatId,
        sender_id: user.id,
        content_enc: encrypted.ciphertext,
        content_iv: encrypted.iv,
        content_tag: encrypted.tag,
      })
      .select("id, chat_id, sender_id, created_at")
      .single();

    if (messageError || !message) {
      return new Response(
        JSON.stringify({
          error: "message_send_failed",
          message: messageError?.message ?? "Unable to send message",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        status: "sent",
        chat_id: chatId,
        message_id: message.id,
        message: {
          id: message.id,
          chat_id: message.chat_id,
          sender_id: message.sender_id,
          content: content,
          created_at: message.created_at,
        },
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: "internal_error",
        message: err?.message ?? "Unexpected error",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
