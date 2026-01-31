import type Chat from '@/modules/database/models/Chat';
import type Match from '@/modules/database/models/Match';
import type Message from '@/modules/database/models/Message';
import { syncDatabase } from '@/modules/database/sync';
import { logger } from '@/utils/logger';
import { requestReviewAfterFirstMatch } from '@/utils/review';
import { Database, Q } from '@nozbe/watermelondb';

/**
 * Debounce para agrupar múltiplos syncs em um único
 * Útil quando vários matches/chats são criados rapidamente
 */
let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const SYNC_DEBOUNCE_MS = 500; // 500ms de debounce

function debouncedSync(database: Database): void {
  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
  }
  
  syncDebounceTimer = setTimeout(() => {
    logger.log('🔄 Executing debounced sync...');
    syncDatabase(database).catch((err) => {
      logger.error('Debounced sync failed:', err);
    });
    syncDebounceTimer = null;
  }, SYNC_DEBOUNCE_MS);
}

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
          const isFirstMessage = !chat.lastMessageAt;
          
          const updatedChat = chat.prepareUpdate((c: any) => {
            logger.log(`📝 Updating chat ${chat_id}:`, {
              lastMessageAt: created_at,
              unreadCount: sender_id !== currentUserId ? (c.unreadCount || 0) + 1 : c.unreadCount,
              senderId: sender_id,
              currentUserId,
            });
            c.lastMessageContent = content;
            c.lastMessageAt = new Date(created_at);
            if (sender_id !== currentUserId) {
              c.unreadCount = (c.unreadCount || 0) + 1;
            }
          });
          batch.push(updatedChat);
          
          // 3. If first message, also update the match
          if (isFirstMessage && chat.matchId) {
            try {
              const matchesCollection = database.collections.get<Match>('matches');
              const match = await matchesCollection.find(chat.matchId);
              const updatedMatch = match.prepareUpdate((m: any) => {
                m.firstMessageAt = new Date(created_at);
              });
              batch.push(updatedMatch);
              logger.log(`✅ Will update match ${chat.matchId} with first_message_at (realtime)`);
            } catch (matchError) {
              logger.warn(`Could not find match ${chat.matchId} to update:`, matchError);
            }
          }
        } catch (error) {
          logger.error('Chat not found for message:', chat_id, error);
          shouldSyncAfter = true;
        }

        // 4. Execute all operations atomically
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
            const isFirstMessage = !chat.lastMessageAt;
            const batchForConstraint: any[] = [];
            
            const updatedChat = chat.prepareUpdate((c: any) => {
              c.lastMessageContent = content;
              c.lastMessageAt = new Date(created_at);
              if (sender_id !== currentUserId) {
                c.unreadCount = (c.unreadCount || 0) + 1;
              }
            });
            batchForConstraint.push(updatedChat);
            
            // If first message, also update the match
            if (isFirstMessage && chat.matchId) {
              try {
                const matchesCollection = database.collections.get<Match>('matches');
                const match = await matchesCollection.find(chat.matchId);
                const updatedMatch = match.prepareUpdate((m: any) => {
                  m.firstMessageAt = new Date(created_at);
                });
                batchForConstraint.push(updatedMatch);
                logger.log(`✅ Will update match ${chat.matchId} with first_message_at (constraint error path)`);
              } catch (matchError) {
                logger.warn(`Could not find match ${chat.matchId} to update:`, matchError);
              }
            }
            
            await database.batch(...batchForConstraint);
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
 * 
 * Para INSERT (novo match): dispara sync completo pois precisamos dos dados denormalizados
 * Para UPDATE (match existente): atualiza campos específicos localmente
 * 
 * Nota: RLS garante que postgres_changes só dispara para matches do usuário atual
 */
export async function handleMatchUpdate(
  payload: any,
  database: Database,
): Promise<void> {
  try {
    logger.log('📬 Processing match update:', payload);

    // Para UPDATE, verificar se foi unmatch e deletar localmente
    await database.write(async () => {
      const matchesCollection = database.collections.get<Match>('matches');
      const chatsCollection = database.collections.get<Chat>('chats');
      const messagesCollection = database.collections.get<Message>('messages');
      
      const { id, status, ...updateData } = payload;
      
      try {
        const match = await matchesCollection.find(id);
        
        // Se foi unmatch, deletar localmente o match E o chat associado
        if (status === 'unmatched') {
          // Buscar e deletar o chat associado (se existir)
          const associatedChats = await chatsCollection
            .query(Q.where('match_id', id))
            .fetch();
          
          const deleteOperations: any[] = [match.prepareDestroyPermanently()];
          
          if (associatedChats.length > 0) {
            logger.log(`🗑️ Found ${associatedChats.length} chat(s) to delete for unmatched match:`, id);
            for (const chat of associatedChats) {
              deleteOperations.push(chat.prepareDestroyPermanently());
              const messages = await messagesCollection
                .query(Q.where('chat_id', chat.id))
                .fetch();
              if (messages.length > 0) {
                messages.forEach((message) => {
                  deleteOperations.push(message.prepareDestroyPermanently());
                });
              }
            }
          }
          
          await database.batch(...deleteOperations);
          logger.log('🗑️ Match and associated chat(s) deleted due to unmatch:', id);
          return;
        }
        
        // Caso contrário, atualizar campos
        await match.update((m: any) => {
          m.status = status;
          Object.assign(m, updateData);
        });
        logger.log('✅ Match updated:', id);
      } catch (error) {
        // Match não existe localmente, disparar sync
        logger.warn('Match not found locally, triggering sync:', id);
        syncDatabase(database).catch((err) => {
          logger.error('Failed to sync after match not found:', err);
        });
      }
    });
  } catch (error) {
    logger.error('Failed to handle match update:', error);
  }
}

function toDateOrNull(value: number | string | null | undefined): Date | null {
  if (value == null) return null;
  return new Date(value);
}

export async function handleNewMatchBroadcast(
  payload: any,
  database: Database
): Promise<void> {
  try {
    const matchesCollection = database.collections.get<Match>('matches');
    const chatsCollection = database.collections.get<Chat>('chats');
    const matchId = payload?.id;

    if (!matchId) {
      logger.warn('NEW_MATCH payload missing id:', payload);
      return;
    }

    await database.write(async () => {
      const existing = await matchesCollection.query(Q.where('id', matchId)).fetch();
      if (existing.length === 0) {
        await matchesCollection.create((record: any) => {
          record._raw.id = matchId;
          record.chatId = payload.chat_id ?? null;
          record.userA = payload.user_a;
          record.userB = payload.user_b;
          record.status = payload.status;
          record.matchedAt = toDateOrNull(payload.matched_at) ?? new Date();
          record.unmatchedAt = toDateOrNull(payload.unmatched_at);
          record.placeId = payload.place_id ?? null;
          record.placeName = payload.place_name ?? null;
          record.userAOpenedAt = toDateOrNull(payload.user_a_opened_at);
          record.userBOpenedAt = toDateOrNull(payload.user_b_opened_at);
          record.otherUserId = payload.other_user_id ?? null;
          record.otherUserName = payload.other_user_name ?? null;
          record.otherUserPhotoUrl = payload.other_user_photo_url ?? null;
          record.firstMessageAt = toDateOrNull(payload.first_message_at);
        });
        logger.log('✅ Match created from broadcast:', matchId);
        
        // Request review after first match (with delay)
        // This will only execute once per user, tracked via AsyncStorage
        requestReviewAfterFirstMatch().catch((err) => {
          logger.error('Failed to request review after match:', err);
        });
        
        return;
      }

      await existing[0].update((record: any) => {
        record.chatId = payload.chat_id ?? null;
        record.userA = payload.user_a;
        record.userB = payload.user_b;
        record.status = payload.status;
        record.matchedAt = toDateOrNull(payload.matched_at) ?? record.matchedAt;
        record.unmatchedAt = toDateOrNull(payload.unmatched_at);
        record.placeId = payload.place_id ?? null;
        record.placeName = payload.place_name ?? null;
        record.userAOpenedAt = toDateOrNull(payload.user_a_opened_at);
        record.userBOpenedAt = toDateOrNull(payload.user_b_opened_at);
        record.otherUserId = payload.other_user_id ?? null;
        record.otherUserName = payload.other_user_name ?? null;
        record.otherUserPhotoUrl = payload.other_user_photo_url ?? null;
        record.firstMessageAt = toDateOrNull(payload.first_message_at);
      });

      logger.log('✅ Match updated from broadcast:', matchId);
    });

    const chatId = payload?.chat_id;
    if (!chatId) return;
    const otherUserId = payload?.other_user_id;
    if (!otherUserId) {
      logger.warn('NEW_MATCH payload missing other_user_id for chat:', payload);
      return;
    }

    await database.write(async () => {
      const existingChat = await chatsCollection.query(Q.where('id', chatId)).fetch();
      if (existingChat.length > 0) return;

      const createdAt = toDateOrNull(payload.chat_created_at) ?? new Date();
      const chat = chatsCollection.prepareCreate((record: any) => {
        record._raw.id = chatId;
        record.matchId = matchId;
        record.createdAt = createdAt;
        record.lastMessageContent = null;
        record.lastMessageAt = toDateOrNull(payload.first_message_at);
        record.otherUserId = otherUserId;
        record.otherUserName = payload.other_user_name ?? null;
        record.otherUserPhotoUrl = payload.other_user_photo_url ?? null;
        record.placeId = payload.place_id ?? null;
        record.placeName = payload.place_name ?? null;
        record.unreadCount = 0;
      });

      await database.batch(chat);
      logger.log('✅ Chat created from NEW_MATCH broadcast:', chatId);
    });
  } catch (error) {
    logger.error('Failed to handle NEW_MATCH broadcast:', error);
  }
}

/**
 * Processa novo chat (novo match com primeira mensagem)
 * 
 * Dispara sync completo pois precisamos dos dados denormalizados
 * Isso evita race conditions entre realtime e sync
 * 
 * Nota: RLS garante que postgres_changes só dispara para chats do usuário atual
 */
