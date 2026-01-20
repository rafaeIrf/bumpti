/// <reference types="https://deno.land/x/supabase@1.7.4/functions/types.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { corsHeaders } from "../_shared/cors.ts";
import { encryptMessage, getEncryptionKey } from "../_shared/encryption.ts";

/**
 * Push Changes - Recebe writes do WatermelonDB
 * 
 * Este endpoint processa mudanças locais que o app quer sincronizar:
 * - Mensagens enviadas (status: pending → sent)
 * - Mensagens marcadas como lidas
 * - Matches marcados como abertos
 * 
 * POST /push-changes
 * Body: {
 *   messages?: {
 *     created: Array<{ temp_id, chat_id, content, ... }>,
 *     updated: Array<{ id, ... }>,
 *   },
 *   read_receipts?: Array<{ message_id }>,
 *   match_opens?: Array<{ match_id }>
 * }
 * 
 * Response: {
 *   messages: {
 *     created: Array<{ temp_id, id, created_at }>, // mapeamento temp → real
 *     updated: Array<{ id, updated_at }>
 *   },
 *   errors?: Array<{ temp_id?, error }>
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
      return new Response(JSON.stringify({ error: "encryption_key_missing" }), {
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
    const response: any = {
      messages: { created: [], updated: [] },
      read_receipts: [],
      match_opens: [],
      errors: [],
    };

    // 1. Process created messages
    if (body.messages?.created) {
      for (const msg of body.messages.created) {
        try {
          // Validate chat access
          const { data: chat } = await supabase
            .from("chats")
            .select("id, match_id")
            .eq("id", msg.chat_id)
            .single();

          if (!chat) {
            response.errors.push({
              temp_id: msg.temp_id,
              error: "chat_not_found",
            });
            continue;
          }

          // Validate match
          const { data: match } = await supabase
            .from("user_matches")
            .select("user_a, user_b, status")
            .eq("id", chat.match_id)
            .single();

          if (!match || match.status !== "active") {
            response.errors.push({
              temp_id: msg.temp_id,
              error: "invalid_match",
            });
            continue;
          }

          if (match.user_a !== user.id && match.user_b !== user.id) {
            response.errors.push({
              temp_id: msg.temp_id,
              error: "unauthorized",
            });
            continue;
          }

          // Encrypt content
          const encrypted = await encryptMessage(msg.content, encryptionKey);
          
          if (!encrypted) {
            response.errors.push({
              temp_id: msg.temp_id,
              error: "encryption_failed",
            });
            continue;
          }
          
          const { ciphertext, iv, tag } = encrypted;

          // Insert message - use client ID if provided, otherwise let Postgres generate
          const insertData: any = {
            chat_id: msg.chat_id,
            sender_id: user.id,
            content_enc: ciphertext,
            content_iv: iv,
            content_tag: tag,
          };
          
          // Use client-provided UUID if available (prevents duplication on sync)
          if (msg.id) {
            insertData.id = msg.id;
          }

          const { data: newMessage, error: insertError } = await supabase
            .from("messages")
            .insert(insertData)
            .select("id, created_at")
            .single();

          if (insertError || !newMessage) {
            console.error("Failed to insert message:", insertError);
            response.errors.push({
              temp_id: msg.temp_id,
              id: msg.id,
              error: "insert_failed",
            });
            continue;
          }

          // Success - return mapping
          response.messages.created.push({
            temp_id: msg.temp_id,
            id: newMessage.id,
            created_at: new Date(newMessage.created_at).getTime(),
            synced_at: Date.now(),
          });

          // ✅ SEND-AND-BROADCAST: Enviar via Realtime com conteúdo descriptografado
          try {
            // Broadcast for the other user (global user channel)
            const recipientId = match.user_a === user.id ? match.user_b : match.user_a;
            const channelName = `messages-${recipientId}`;
            const payload = {
              id: newMessage.id,
              chat_id: msg.chat_id,
              sender_id: user.id,
              content: msg.content, // ✅ texto plano (já temos em memória)
              created_at: new Date(newMessage.created_at).getTime(),
              read_at: null,
              status: 'sent',
              synced_at: Date.now(),
            };

            console.log(`📤 Preparing broadcast to ${channelName}:`, {
              messageId: payload.id,
              chatId: payload.chat_id,
              senderId: payload.sender_id,
              content: payload.content,
              createdAt: payload.created_at,
            });

            // Enviar broadcast usando cliente Supabase
            const channel = supabase.channel(channelName);
            await channel.send({
              type: 'broadcast',
              event: 'new_message',
              payload,
            });

            console.log(`✅ Broadcast sent successfully to ${channelName}:`, payload.id);
          } catch (broadcastError) {
            // Não falhar a request se broadcast falhar
            // Cliente fará pull incremental via sync-chat-data
            console.error('❌ Broadcast failed (non-fatal):', broadcastError);
          }

          // Update chat's updated_at to trigger sync
          await supabase
            .from("chats")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", msg.chat_id);
        } catch (error) {
          console.error("Error creating message:", error);
          response.errors.push({
            temp_id: msg.temp_id,
            error: error.message,
          });
        }
      }
    }

    // 2. Process read receipts
    if (body.read_receipts) {
      for (const receipt of body.read_receipts) {
        try {
          const { error } = await supabase
            .from("messages")
            .update({ read_at: new Date().toISOString() })
            .eq("id", receipt.message_id)
            .is("read_at", null); // Only update if not already read

          if (!error) {
            response.read_receipts.push({
              message_id: receipt.message_id,
              read_at: Date.now(),
            });
          }
        } catch (error) {
          console.error("Failed to mark message as read:", error);
        }
      }
    }

    // 3. Process match opens
    if (body.match_opens) {
      for (const open of body.match_opens) {
        try {
          const { data: match } = await supabase
            .from("user_matches")
            .select("user_a, user_b")
            .eq("id", open.match_id)
            .single();

          if (match) {
            const updateField = match.user_a === user.id
              ? "user_a_opened_at"
              : "user_b_opened_at";

            await supabase
              .from("user_matches")
              .update({ [updateField]: new Date().toISOString() })
              .eq("id", open.match_id)
              .is(updateField, null);

            response.match_opens.push({
              match_id: open.match_id,
              opened_at: Date.now(),
            });
          }
        } catch (error) {
          console.error("Failed to mark match as opened:", error);
        }
      }
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Push changes error:", error);
    return new Response(
      JSON.stringify({ error: "internal_server_error", details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
