/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { decryptMessage, getEncryptionKey } from "../_shared/encryption.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
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

    const url = new URL(req.url);
    const queryChatId = url.searchParams.get("chat_id");
    const queryBefore = url.searchParams.get("before");

    const body =
      req.method === "POST" ? await req.json().catch(() => null) : null;

    const chatId =
      (body?.chat_id as string | undefined) ??
      (queryChatId ?? undefined);
    const before =
      (body?.before as string | undefined) ??
      (queryBefore ?? undefined);

    if (!chatId || typeof chatId !== "string") {
      return new Response(JSON.stringify({ error: "invalid_chat_id" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { data: chat, error: chatError } = await supabase
      .from("chats")
      .select("id, match_id")
      .eq("id", chatId)
      .maybeSingle();

    if (chatError) {
      return new Response(
        JSON.stringify({
          error: "chat_lookup_failed",
          message: chatError.message,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!chat?.id || !chat.match_id) {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    const { data: match, error: matchError } = await supabase
      .from("user_matches")
      .select("user_a, user_b, status")
      .eq("id", chat.match_id)
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

    if (
      !match ||
      match.status !== "active" ||
      (match.user_a !== user.id && match.user_b !== user.id)
    ) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    let messagesQuery = supabase
      .from("messages")
      .select("id, chat_id, sender_id, content_enc, content_iv, content_tag, created_at, read_at")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true })

    if (before) {
      messagesQuery = messagesQuery.lt("created_at", before);
    }

    const { data: encryptedMessages, error: messagesError } = await messagesQuery;

    if (messagesError) {
      return new Response(
        JSON.stringify({
          error: "messages_fetch_failed",
          message: messagesError.message,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Get encryption key from secrets
    const encryptionKey = await getEncryptionKey();
    if (!encryptionKey) {
      return new Response(
        JSON.stringify({
          error: "decryption_failed",
          message: "Unable to retrieve encryption key",
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Decrypt all messages
    const messages = await Promise.all(
      (encryptedMessages ?? []).map(async (msg: any) => {
        // If any of the encryption fields are missing, return error placeholder
        if (!msg.content_enc || !msg.content_iv || !msg.content_tag) {
          return {
            id: msg.id,
            chat_id: msg.chat_id,
            sender_id: msg.sender_id,
            content: "[unable_to_decrypt]",
            created_at: msg.created_at,
            read_at: msg.read_at,
            error: "missing_encryption_data",
          };
        }

        // Decrypt the message
        const decrypted = await decryptMessage(
          msg.content_enc,
          msg.content_iv,
          msg.content_tag,
          encryptionKey
        );

        if (!decrypted) {
          // If decryption fails, return error placeholder
          return {
            id: msg.id,
            chat_id: msg.chat_id,
            sender_id: msg.sender_id,
            content: "[unable_to_decrypt]",
            created_at: msg.created_at,
            read_at: msg.read_at,
            error: "decryption_failed",
          };
        }

        return {
          id: msg.id,
          chat_id: msg.chat_id,
          sender_id: msg.sender_id,
          content: decrypted,
          created_at: msg.created_at,
          read_at: msg.read_at,
        };
      })
    );

    return new Response(
      JSON.stringify({
        chat_id: chatId,
        messages,
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
