import type Chat from '@/modules/database/models/Chat';
import type Match from '@/modules/database/models/Match';
import type Message from '@/modules/database/models/Message';
import { syncDatabase } from '@/modules/database/sync';
import { logger } from '@/utils/logger';
import { Database, Q } from '@nozbe/watermelondb';

/**
 * Processa broadcast de nova mensagem
 * Insere diretamente no WatermelonDB
 */
export async function handleNewMessageBroadcast(
  payload: any,
  currentUserId: string,
  database: Database
): Promise<void> {
  let shouldSyncAfter = false;

  try {
    const { id, chat_id, sender_id, content, created_at, status } = payload;

    // Ignore own messages to avoid duplicate handling (already in local DB)
    if (sender_id === currentUserId) {
      logger.log('Ignoring own message from broadcast:', id);
      return;
    }

    const messagesCollection = database.collections.get<Message>('messages');
    const chatsCollection = database.collections.get<Chat>('chats');

    // Combine message insert + chat update in a SINGLE atomic transaction
    try {
      await database.write(async () => {
        const batch: any[] = [];
        
        // 1. Check and prepare message creation
        const existing = await messagesCollection.query(Q.where('id', id)).fetch();
        
        if (existing.length === 0) {
          const newMessage = messagesCollection.prepareCreate((message: any) => {
            message._raw.id = id;
            message.chatId = chat_id;
            message.senderId = sender_id;
            message.content = content;
            message.createdAt = new Date(created_at);
            message.status = status || 'sent';
          });
          batch.push(newMessage);
        }

        // 2. Prepare chat update
        try {
          const chat = await chatsCollection.find(chat_id);
          const updatedChat = chat.prepareUpdate((c: any) => {
            c.lastMessageContent = content;
            c.lastMessageAt = new Date(created_at);
            if (sender_id !== currentUserId) {
              c.unreadCount = (c.unreadCount || 0) + 1;
            }
          });
          batch.push(updatedChat);
        } catch (error) {
          logger.error('Chat not found for message:', chat_id, error);
          shouldSyncAfter = true;
        }

        // 3. Execute all operations atomically
        if (batch.length > 0) {
          await database.batch(...batch);
        }
      });
    } catch (error: any) {
      // Ignore constraint errors (message already exists from another source)
      if (error?.message?.includes('UNIQUE constraint failed') || 
          error?.message?.includes('SQLITE_CONSTRAINT_PRIMARYKEY')) {
        // Silently ignore - this is expected when broadcast and sync arrive simultaneously
        // But still update the chat
        try {
          await database.write(async () => {
            const chat = await chatsCollection.find(chat_id);
            await chat.update((c: any) => {
              c.lastMessageContent = content;
              c.lastMessageAt = new Date(created_at);
              if (sender_id !== currentUserId) {
                c.unreadCount = (c.unreadCount || 0) + 1;
              }
            });
          });
        } catch (chatError) {
          logger.error('Failed to update chat after constraint error:', chatError);
        }
      } else {
        // Re-throw other errors
        throw error;
      }
    }

    if (shouldSyncAfter) {
      syncDatabase(database).catch((err) => {
        logger.error('Sync after missing chat failed:', err);
      });
    }
  } catch (error) {
    logger.error('Failed to handle new message broadcast:', error);
    // Don't throw - we don't want to break the entire broadcast subscription
    // The sync mechanism will eventually catch up
  }
}

/**
 * Processa atualização de match
 */
export async function handleMatchUpdate(
  payload: any,
  database: Database
): Promise<void> {
  try {
    logger.log('📬 Processing match update:', payload);

    await database.write(async () => {
      const matchesCollection = database.collections.get<Match>('matches');
      
      const { id, ...updateData } = payload;
      
      try {
        const match = await matchesCollection.find(id);
        await match.update((m: any) => {
          Object.assign(m, updateData);
        });
        logger.log('✅ Match updated:', id);
      } catch (error) {
        // Match não existe localmente, será pego no próximo sync
        logger.warn('Match not found locally, will sync:', id);
      }
    });
  } catch (error) {
    logger.error('Failed to handle match update:', error);
  }
}

/**
 * Processa novo chat (novo match com primeira mensagem)
 */
export async function handleNewChat(
  payload: any,
  database: Database
): Promise<void> {
  try {
    logger.log('💬 Processing new chat:', payload);

    await database.write(async () => {
      const chatsCollection = database.collections.get<Chat>('chats');
      
      const { id, ...chatData } = payload;
      
      // Verificar se já existe
      const existing = await chatsCollection.query(Q.where('id', id)).fetch();
      if (existing.length > 0) {
        logger.log('Chat already exists:', id);
        return;
      }

      await chatsCollection.create((chat: any) => {
        chat._raw.id = id;
        Object.assign(chat, chatData);
      });

      logger.log('✅ New chat created:', id);
    });
  } catch (error) {
    logger.error('Failed to handle new chat:', error);
  }
}
