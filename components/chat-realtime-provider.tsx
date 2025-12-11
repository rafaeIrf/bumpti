import {
  attachChatListRealtime,
  attachMatchOverviewRealtime,
  messagesApi,
} from "@/modules/chats/messagesApi";
import { pendingLikesApi } from "@/modules/pendingLikes/pendingLikesApi";
import { attachPendingLikesRealtime } from "@/modules/pendingLikes/realtime";
import { useAppDispatch } from "@/modules/store/hooks";
import { supabase } from "@/modules/supabase/client";
import { useEffect } from "react";

export function ChatRealtimeProvider({
  children,
}: {
  children?: React.ReactNode;
}) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    // Prime chats from backend on app start, then rely on realtime updates.
    dispatch(messagesApi.util.invalidateTags([{ type: "Chat", id: "LIST" }]));
    dispatch(messagesApi.util.invalidateTags([{ type: "Match", id: "LIST" }]));
    dispatch(
      messagesApi.util.invalidateTags([{ type: "Message", id: "LIST" }])
    );
    dispatch(
      pendingLikesApi.util.invalidateTags([
        { type: "PendingLikes", id: "LIST" },
      ])
    );

    const setupRealtime = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const matchChannel = attachMatchOverviewRealtime(dispatch);
      const chatChannel = attachChatListRealtime(dispatch, user.id);
      const pendingLikesChannel = attachPendingLikesRealtime(dispatch, user.id);

      return () => {
        matchChannel?.unsubscribe?.();
        chatChannel?.unsubscribe?.();
        pendingLikesChannel?.unsubscribe?.();
      };
    };

    const cleanup = setupRealtime();

    return () => {
      cleanup.then((fn) => fn?.());
    };
  }, [dispatch]);

  return children ?? null;
}
