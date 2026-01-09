import { useDatabase } from '@/components/DatabaseProvider';
import type Chat from "@/modules/database/models/Chat";
import type Match from "@/modules/database/models/Match";
import type Message from "@/modules/database/models/Message";
import { supabase } from "@/modules/supabase/client";
import { logger } from "@/utils/logger";
import { Q } from "@nozbe/watermelondb";
import { useCallback, useState } from "react";

/**
 * Status da mensagem durante o envio
 */
export type MessageStatus = "pending" | "sent" | "delivered" | "error";

/**
 * Hook para enviar mensagens com optimistic updates
 */
export function useSendMessage(chatId: string, currentUserId: string) {
  const database = useDatabase();
  const [isSending, setIsSending] = useState(false);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isSending) return;

      setIsSending(true);
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      try {
        // 1. Create optimistic message
        await database.write(async () => {
          const messagesCollection = database.collections.get<Message>("messages");
          const chatsCollection = database.collections.get<Chat>("chats");
          const matchesCollection = database.collections.get<Match>("matches");
          const chat = await chatsCollection.find(chatId);

          // Check if this is the first message
          const isFirstMessage = !chat.firstMessageAt;

          // Use batch for atomic operations
          const batch = [
            messagesCollection.prepareCreate((message: any) => {
              message.tempId = tempId;
              message.chatId = chatId;
              message.senderId = currentUserId;
              message.content = content.trim();
              message.status = "pending";
              message.createdAt = new Date();
            }),
            chat.prepareUpdate((c: any) => {
              c.lastMessageContent = content.trim();
              c.lastMessageAt = new Date();
              // Set first_message_at if this is the first message
              if (isFirstMessage) {
                c.firstMessageAt = new Date();
              }
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

        logger.log("✅ Optimistic message created:", tempId);

        // 2. Send to backend via push-changes
        const { data, error } = await supabase.functions.invoke("push-changes", {
          body: {
            messages: {
              created: [
                {
                  temp_id: tempId,
                  chat_id: chatId,
                  content: content.trim(),
                },
              ],
            },
          },
        });

        if (error) throw error;

        // 3. Update with real ID and status
        const realId = data?.messages?.created?.[0]?.id;
        const timestamp = data?.messages?.created?.[0]?.created_at;

        if (realId) {
          await database.write(async () => {
            const messagesCollection = database.collections.get<Message>("messages");
            const tempMessages = await messagesCollection
              .query(Q.where("temp_id", tempId))
              .fetch();

            if (tempMessages.length > 0) {
              const batch = [
                tempMessages[0].prepareMarkAsDeleted(),
                messagesCollection.prepareCreate((message: any) => {
                  message._raw.id = realId;
                  message.chatId = chatId;
                  message.senderId = currentUserId;
                  message.content = content.trim();
                  message.status = "sent";
                  message.createdAt = timestamp ? new Date(timestamp) : new Date();
                }),
              ];

              await database.batch(...batch);
              logger.log("✅ Message saved with server ID:", realId);
            }
          });
        }
      } catch (error) {
        logger.error("Failed to send message:", error);

        // Mark as error
        await database.write(async () => {
          const messagesCollection = database.collections.get<Message>("messages");
          const messages = await messagesCollection
            .query(Q.where("temp_id", tempId))
            .fetch();

          if (messages.length > 0) {
            await messages[0].update((m: any) => {
              m.status = "error";
            });
          }
        });
      } finally {
        setIsSending(false);
      }
    },
    [database, chatId, currentUserId, isSending]
  );

  return { sendMessage, isSending };
}
