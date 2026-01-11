import { useDatabase } from "@/components/DatabaseProvider";
import { useProfile } from "@/hooks/use-profile";
import { useGlobalSubscriptions } from "@/hooks/useChatSubscription";
import { handleNewMatchBroadcast } from "@/modules/database/realtime/handlers";
import {
  attachLikerIdsRealtime,
  attachMatchRealtime,
} from "@/modules/discovery/realtime";
import { attachPendingLikesRealtime } from "@/modules/pendingLikes/realtime";
import { useAppDispatch } from "@/modules/store/hooks";
import { useEffect } from "react";

/**
 * Provider para gerenciar subscriptions globais do Realtime
 * Agora integrado com WatermelonDB ao invés de RTK Query
 */
export function ChatRealtimeProvider({
  children,
}: {
  children?: React.ReactNode;
}) {
  const { profile } = useProfile();
  const dispatch = useAppDispatch();
  const database = useDatabase();

  // Setup global subscriptions (matches, chat list)
  useGlobalSubscriptions(profile?.id ?? null);

  useEffect(() => {
    if (!profile?.id) return;

    const channel = attachPendingLikesRealtime(dispatch, profile.id);
    const likerChannel = attachLikerIdsRealtime({
      database,
      userId: profile.id,
    });
    const matchChannel = attachMatchRealtime({
      userId: profile.id,
      onNewMatch: async (payload) => {
        await handleNewMatchBroadcast(payload, database);
      },
    });

    return () => {
      channel.unsubscribe();
      likerChannel.unsubscribe();
      matchChannel.unsubscribe();
    };
  }, [database, dispatch, profile?.id]);

  return <>{children}</>;
}
