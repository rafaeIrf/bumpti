import { useDatabase } from '@/components/DatabaseProvider';
import { useProfile } from '@/hooks/use-profile';
import { updateMatch as updateMatchApi } from '@/modules/chats/api';
import type Match from '@/modules/database/models/Match';
import { logger } from '@/utils/logger';
import { useCallback } from 'react';

export function useMarkMatchOpened() {
  const database = useDatabase();
  const { profile } = useProfile();

  const markMatchAsOpened = useCallback(
    async (match: Match) => {
      const userId = profile?.id;
      if (!userId) return;
      
      // Check if it's a new match for current user
      if (!match.isNewMatch(userId)) return;

      try {
        // Update local WatermelonDB immediately (optimistic)
        await database.write(async () => {
          await match.markAsOpened(userId);
        });

        logger.log('✅ Match marked as opened locally:', match.id);

        // Update backend (non-blocking)
        updateMatchApi({
          matchId: match.id,
          markOpened: true,
        }).catch((error) => {
          logger.error('Failed to update match on backend:', error);
        });
      } catch (error) {
        logger.error('Failed to mark match as opened:', error);
      }
    },
    [database, profile?.id]
  );

  return { markMatchAsOpened };
}

