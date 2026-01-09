import { useDatabase } from '@/components/DatabaseProvider';
import { markMessagesRead as markMessagesReadApi } from '@/modules/chats/api';
import Chat from '@/modules/database/models/Chat';
import type Message from '@/modules/database/models/Message';
import { logger } from '@/utils/logger';
import { useCallback } from 'react';

export function useMarkMessagesRead() {
  const database = useDatabase();

  const markMessagesAsRead = useCallback(
    async (params: {
      chatId: string;
      messages: Message[];
      userId: string;
    }) => {
      const { chatId, messages, userId } = params;

      // Filter messages that are from other user and not read
      const unreadMessages = messages.filter(
        (m) => !m.readAt && m.senderId !== userId
      );

      if (unreadMessages.length === 0) return;

      try {
        const chatsCollection = database.collections.get<Chat>('chats');
        const chat = await chatsCollection.find(chatId);

        // Use batch for atomic operation: mark messages + zero unread count
        await database.write(async () => {
          const now = new Date();
          const batch = [
            ...unreadMessages.map((msg) =>
              msg.prepareUpdate((m) => {
                m.readAt = now;
              })
            ),
            // Zero unread count locally
            chat.prepareUpdate((c: any) => {
              c.unreadCount = 0;
            }),
          ];
          await database.batch(...batch);
        });

        logger.log(`✅ Marked ${unreadMessages.length} messages as read`);

        // Notify backend (non-blocking)
        markMessagesReadApi({ chatId }).catch((err) => {
          logger.error('Failed to mark messages read on backend:', err);
        });
      } catch (error) {
        logger.error('Failed to mark messages as read:', error);
      }
    },
    [database]
  );

  return { markMessagesAsRead };
}

