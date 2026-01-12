/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { corsHeaders } from "../_shared/cors.ts";
import { decryptMessage, getEncryptionKey } from "../_shared/encryption.ts";

/**
 * Deep History Pagination for Messages
 * 
 * Este endpoint SOMENTE é chamado quando:
 * - O usuário faz scroll para cima no chat
 * - O WatermelonDB local não tem mais mensagens antigas em cache
 * 
 * Para mensagens recentes, use sync-chat-data
 * 
 * POST /get-messages
 * Body: { 
 *   chat_id: string, 
 *   before: number (timestamp), // obrigatório para paginação
 *   limit: number (default: 50)
 * }
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const encryptionKey = await getEncryptionKey();

    if (!encryptionKey) {
      return new Response(JSON.stringify({ error: "encryption_key_not_found" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse body
    const body = await req.json();
    const chatId = body.chat_id;
    const before = body.before; // timestamp obrigatório
    const limit = body.limit || 50;

    if (!chatId) {
      return new Response(JSON.stringify({ error: "chat_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!before) {
      return new Response(
        JSON.stringify({ 
          error: "before timestamp is required for pagination. Use sync-chat-data for initial sync." 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify user has access to this chat
    const { data: chat, error: chatError } = await supabase
      .from("chats")
      .select("id, match_id")
      .eq("id", chatId)
      .single();

    if (chatError || !chat) {
      return new Response(JSON.stringify({ error: "chat_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify match access
    const { data: match } = await supabase
      .from("user_matches")
      .select("user_a, user_b, status")
      .eq("id", chat.match_id)
      .single();

    if (!match || (match.user_a !== user.id && match.user_b !== user.id)) {
      return new Response(JSON.stringify({ error: "unauthorized_chat_access" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch messages older than "before" timestamp
    const beforeDate = new Date(before).toISOString();
    const fetchLimit = limit + 1; // +1 to check if there are more

    const { data: encryptedMessages, error: messagesError } = await supabase
      .from("messages")
      .select("id, chat_id, sender_id, content_enc, content_iv, content_tag, created_at, read_at")
      .eq("chat_id", chatId)
      .lt("created_at", beforeDate)
      .order("created_at", { ascending: false })
      .limit(fetchLimit);

    if (messagesError) {
      console.error("Error fetching messages:", messagesError);
      return new Response(
        JSON.stringify({ error: "failed_to_fetch_messages" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if there are more messages
    const hasMore = (encryptedMessages?.length || 0) > limit;
    const messagesToProcess = hasMore
      ? encryptedMessages?.slice(0, limit)
      : encryptedMessages;

    // Decrypt messages
    const messages = await Promise.all(
      (messagesToProcess || []).map(async (msg: any) => {
        try {
          const decryptedContent = await decryptMessage(
            msg.content_enc,
            msg.content_iv,
            msg.content_tag,
            encryptionKey
          );

          // Formato WatermelonDB
          return {
            id: msg.id,
            chat_id: msg.chat_id,
            sender_id: msg.sender_id,
            content: decryptedContent,
            created_at: new Date(msg.created_at).getTime(),
            read_at: msg.read_at ? new Date(msg.read_at).getTime() : null,
            status: "sent",
            synced_at: Date.now(),
          };
        } catch (error) {
          console.error("Failed to decrypt message:", msg.id, error);
          return null;
        }
      })
    );

    // Filter out failed decryptions
    const validMessages = messages.filter((m) => m !== null);

    // Reverse to get chronological order (oldest first)
    const sortedMessages = validMessages.reverse();

    // Next cursor é o timestamp da mensagem mais antiga retornada
    const nextCursor = sortedMessages.length > 0
      ? sortedMessages[0].created_at
      : null;

    return new Response(
      JSON.stringify({
        messages: sortedMessages,
        has_more: hasMore,
        next_cursor: hasMore ? nextCursor : null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Deep pagination error:", error);
    return new Response(
      JSON.stringify({ error: "internal_server_error", details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
