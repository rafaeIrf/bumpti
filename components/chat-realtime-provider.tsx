import { useProfile } from "@/hooks/use-profile";
import { usePendingLikesPrefetch } from "@/hooks/use-pending-likes-prefetch";
import { useGlobalSubscriptions } from "@/hooks/useChatSubscription";
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

  // Setup global subscriptions (matches, chat list)
  useGlobalSubscriptions(profile?.id ?? null);
  usePendingLikesPrefetch();

  useEffect(() => {
    if (!profile?.id) return;

    const channel = attachPendingLikesRealtime(dispatch, profile.id);

    return () => {
      channel.unsubscribe();
    };
  }, [dispatch, profile?.id]);

  return <>{children}</>;
}
