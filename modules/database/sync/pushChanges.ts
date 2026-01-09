import { supabase } from '@/modules/supabase/client';
import { logger } from '@/utils/logger';
import type { PushChangesResponse } from './types';

/**
 * Envia mudanças locais para o backend
 * Chama o endpoint push-changes
 */
export async function pushChanges(
  changes: any,
  lastPulledAt: number
): Promise<PushChangesResponse> {
  try {
    logger.log('🔼 Pushing changes to backend...', {
      created: {
        matches: changes.matches?.created?.length || 0,
        chats: changes.chats?.created?.length || 0,
        messages: changes.messages?.created?.length || 0,
      },
      updated: {
        matches: changes.matches?.updated?.length || 0,
        chats: changes.chats?.updated?.length || 0,
        messages: changes.messages?.updated?.length || 0,
      },
      deleted: {
        matches: changes.matches?.deleted?.length || 0,
        chats: changes.chats?.deleted?.length || 0,
        messages: changes.messages?.deleted?.length || 0,
      },
    });

    const { data, error } = await supabase.functions.invoke('push-changes', {
      body: {
        changes: {
          matches: changes.matches || { created: [], updated: [], deleted: [] },
          chats: changes.chats || { created: [], updated: [], deleted: [] },
          messages: changes.messages || { created: [], updated: [], deleted: [] },
        },
        last_pulled_at: lastPulledAt,
      },
    });

    if (error) {
      logger.error('Failed to push changes:', error);
      throw error;
    }

    logger.log('✅ Changes pushed successfully');

    return {
      success: true,
      timestamp: data?.timestamp || Date.now(),
    };
  } catch (error) {
    logger.error('Push changes failed:', error);
    throw error;
  }
}

