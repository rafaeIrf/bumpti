import { getDatabase } from '@/modules/database';
import {
  handleMatchUpdate,
  handleNewChat,
  handleNewMessageBroadcast,
} from '@/modules/database/realtime/handlers';
import { supabase } from '@/modules/supabase/client';
import { logger } from '@/utils/logger';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

/**
 * Hook para gerenciar subscriptions globais (matches, chats, mensagens)
 * 
 * Este hook assina:
 * - Matches: postgres_changes em user_matches
 * - Chats: postgres_changes em chats
 * - Mensagens: broadcast global em messages-{userId}
 * 
 * Não é necessário assinar chats individuais, pois o canal global
 * de mensagens recebe todas as mensagens do usuário.
 */
export function useGlobalSubscriptions(currentUserId: string | null) {
  const [channels, setChannels] = useState<RealtimeChannel[]>([]);

  useEffect(() => {
    if (!currentUserId) return;

    const setupSubscriptions = async () => {
      try {
        const database = await getDatabase();
        const newChannels: RealtimeChannel[] = [];

        const matchChannel = supabase
          .channel(`matches-${currentUserId}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'user_matches' },
            async (event) => {
              logger.log('📬 Match INSERT:', event);
              await handleMatchUpdate(event.new, database, true); // isInsert = true
            },
          )
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'user_matches' },
            async (event) => {
              logger.log('📬 Match UPDATE:', event);
              await handleMatchUpdate(event.new, database, false); // isInsert = false
            },
          )
          .subscribe();

        newChannels.push(matchChannel);

        // 2. Chats via postgres_changes (dados em claro)
        const chatListChannel = supabase
          .channel(`chats-${currentUserId}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'chats' },
            async (event) => {
              logger.log('💬 Chat INSERT:', event);
              await handleNewChat(event.new, database);
            },
          )
          .subscribe();

        newChannels.push(chatListChannel);

        // 3. Mensagens via broadcast descriptografado (edge push-changes)
        const messageChannel = supabase
          .channel(`messages-${currentUserId}`)
          .on('broadcast', { event: 'new_message' }, async (event) => {
            await handleNewMessageBroadcast(event.payload, currentUserId, database);
          })
          .subscribe();

        newChannels.push(messageChannel);

        setChannels(newChannels);
        logger.log('✅ Global subscriptions setup complete');
      } catch (error) {
        logger.error('Failed to setup global subscriptions:', error);
      }
    };

    setupSubscriptions();

    return () => {
      logger.log('📡 Unsubscribing from all global channels');
      channels.forEach((ch) => ch.unsubscribe());
    };
  }, [currentUserId]);

  return { channels };
}
