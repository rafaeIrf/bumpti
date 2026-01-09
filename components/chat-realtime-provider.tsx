import { useProfile } from "@/hooks/use-profile";
import { useGlobalSubscriptions } from "@/hooks/useChatSubscription";

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

  // Setup global subscriptions (matches, chat list)
  useGlobalSubscriptions(profile?.id ?? null);

  return <>{children}</>;
}
