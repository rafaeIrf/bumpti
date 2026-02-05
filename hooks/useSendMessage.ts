import { useDatabase } from '@/components/DatabaseProvider';
import type Chat from "@/modules/database/models/Chat";
import type Match from "@/modules/database/models/Match";
import type Message from "@/modules/database/models/Message";
import { supabase } from "@/modules/supabase/client";
import { logger } from "@/utils/logger";
import * as Crypto from 'expo-crypto';
import { useCallback, useState } from "react";

/**
 * Status da mensagem durante o envio
 */
export type MessageStatus = "pending" | "sent" | "delivered" | "failed";

/**
 * Generate a proper UUID v4 for message ID
 */
function generateMessageId(): string {
  return Crypto.randomUUID();
}

/**
 * Hook para enviar mensagens com optimistic updates
 * 
 * IMPORTANTE: Usa UUID gerado no cliente para evitar duplicação.
 * O backend usa esse ID diretamente, então não há necessidade de
 * substituir IDs depois do sync.
 */
export function useSendMessage(chatId: string, currentUserId: string) {
  const database = useDatabase();
  const [pendingCount, setPendingCount] = useState(0);
  const isSending = pendingCount > 0;

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      setPendingCount((count) => count + 1);
      
      // Generate UUID that will be used both locally AND on the server
      const messageId = generateMessageId();

      try {
        // 1. Create optimistic message with the FINAL ID
        await database.write(async () => {
          const messagesCollection = database.collections.get<Message>("messages");
          const chatsCollection = database.collections.get<Chat>("chats");
          const matchesCollection = database.collections.get<Match>("matches");
          const chat = await chatsCollection.find(chatId);

          // Check if this is the first message (by checking lastMessageAt on chat)
          const isFirstMessage = !chat.lastMessageAt;

          // Use batch for atomic operations
          // NOTE: We intentionally do NOT update the chat's lastMessageContent here
          // because prepareUpdate marks the record as "dirty" for sync.
          // When sync happens, WatermelonDB would preserve local dirty changes
          // instead of applying server data, causing stale lastMessageContent.
          // The realtime broadcast handler in handlers.ts will update the chat
          // when the server confirms the message.
          const batch: any[] = [
            messagesCollection.prepareCreate((message: any) => {
              message._raw.id = messageId; // Use our generated UUID directly
              message.chatId = chatId;
              message.senderId = currentUserId;
              message.content = content.trim();
              message.status = "pending";
              message.createdAt = new Date();
            }),
          ];

          // If this is the first message, also update the match
          if (isFirstMessage && chat.matchId) {
            try {
              const match = await matchesCollection.find(chat.matchId);
              batch.push(
                match.prepareUpdate((m: any) => {
                  m.firstMessageAt = new Date();
                })
              );
              logger.log(`✅ Will update match ${chat.matchId} with first_message_at`);
            } catch (error) {
              logger.warn(`Could not find match ${chat.matchId} to update:`, error);
            }
          }

          await database.batch(...batch);
        });

        logger.log("✅ Optimistic message created with ID:", messageId);

        // 2. Send to backend via push-changes
        const { data, error } = await supabase.functions.invoke("push-changes", {
          body: {
            messages: {
              created: [
                {
                  id: messageId, // Send the ID we generated
                  chat_id: chatId,
                  content: content.trim(),
                },
              ],
            },
          },
        });

        if (error) throw error;
        if (!data) throw new Error("No data returned from backend");

        // 3. Mark message as sent AND update chat with lastMessageContent
        // This ensures the chat appears in the list immediately for the sender
        // (the realtime handler skips own messages to avoid sync conflicts)
        const serverTimestamp = data?.messages?.created?.[0]?.created_at;
        const messageTimestamp = serverTimestamp ? new Date(serverTimestamp) : new Date();

        await database.write(async () => {
          const messagesCollection = database.collections.get<Message>("messages");
          const chatsCollection = database.collections.get<Chat>("chats");
          
          try {
            const message = await messagesCollection.find(messageId);
            await message.update((m: any) => {
              m.status = "sent";
              if (serverTimestamp) {
                m.createdAt = messageTimestamp;
              }
            });
            logger.log("✅ Message marked as sent:", messageId);
          } catch {
            logger.warn("Message already processed or not found:", messageId);
          }
          
          // Update chat so it appears in the chat list
          try {
            const chat = await chatsCollection.find(chatId);
            await chat.update((c: any) => {
              c.lastMessageContent = content.trim();
              c.lastMessageAt = messageTimestamp;
            });
            logger.log("✅ Chat updated with lastMessageContent");
          } catch {
            logger.warn("Could not update chat:", chatId);
          }
        });
      } catch (error) {
        logger.error("❌ Failed to send message:", error);

        // Mark as failed
        await database.write(async () => {
          const messagesCollection = database.collections.get<Message>("messages");
          try {
            const message = await messagesCollection.find(messageId);
            await message.update((m: any) => {
              m.status = "failed";
            });
          } catch {
            logger.warn("Could not mark message as failed:", messageId);
          }
        });
      } finally {
        setPendingCount((count) => Math.max(0, count - 1));
      }
    },
    [database, chatId, currentUserId]
  );

  return { sendMessage, isSending };
}

