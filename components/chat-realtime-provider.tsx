import {
  attachChatListRealtime,
  attachMatchOverviewRealtime,
  messagesApi,
} from "@/modules/chats/messagesApi";
import { useAppDispatch } from "@/modules/store/hooks";
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

    const matchChannel = attachMatchOverviewRealtime(dispatch);
    const chatChannel = attachChatListRealtime(dispatch);

    return () => {
      matchChannel?.unsubscribe?.();
      chatChannel?.unsubscribe?.();
    };
  }, [dispatch]);

  return children ?? null;
}
