import {
  getChats as fetchChats,
  getMatches as fetchMatches,
  getMessages as fetchMessages,
  sendMessage as sendMessageEdge,
} from "@/modules/chats/api";
import {
  ChatListChange,
  subscribeToChatList,
  subscribeToChatMessages,
  subscribeToMatchOverview,
} from "@/modules/chats/realtime";
import { getCurrentUserId } from "@/modules/store/selectors/profile";
import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";

export type ChatMessage = {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  status?: "sending" | "sent" | "failed";
  tempId?: string;
};

export type ChatSummary = {
  chat_id: string;
  match_id: string;
  place_id: string | null;
  chat_created_at: string | null;
  other_user: {
    id: string;
    name: string | null;
    photo_url?: string | null;
  };
  last_message: string | null;
  last_message_at: string | null;
  unread_count?: number;
};

export type MatchSummary = {
  match_id: string;
  chat_id: string | null;
  matched_at: string | null;
  place_id: string | null;
  is_new_match: boolean;
  other_user: {
    id: string;
    name: string | null;
    photo_url: string | null;
  };
};

export const messagesApi = createApi({
  reducerPath: "messagesApi",
  baseQuery: fakeBaseQuery(),
  tagTypes: ["Chat", "Message", "Match"],
  endpoints: (builder) => ({
    getChats: builder.query<ChatSummary[], void>({
      queryFn: async () => {
        try {
          const { chats } = await fetchChats();
          return {
            data: chats ?? [],
          };
        } catch (error) {
          return { error: { status: "CUSTOM_ERROR", error: String(error) } };
        }
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map((c) => ({ type: "Chat" as const, id: c.chat_id })),
              { type: "Chat", id: "LIST" },
            ]
          : [{ type: "Chat", id: "LIST" }],
    }),
    getMatches: builder.query<MatchSummary[], void>({
      queryFn: async () => {
        try {
          const { matches } = await fetchMatches();
          console.log("Fetched matches:", matches);
          return { data: matches ?? [] };
        } catch (error) {
          return { error: { status: "CUSTOM_ERROR", error: String(error) } };
        }
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map((m) => ({ type: "Match" as const, id: m.match_id })),
              { type: "Match", id: "LIST" },
            ]
          : [{ type: "Match", id: "LIST" }],
    }),

    getMessages: builder.query<ChatMessage[], string>({
      queryFn: async (chatId) => {
        try {
          const data = await fetchMessages({ chatId });
          const messages =
            data.messages?.map((m) => ({ ...m, status: "sent" as const })) ??
            [];
          return { data: messages };
        } catch (error) {
          return { error: { status: "CUSTOM_ERROR", error: String(error) } };
        }
      },
      providesTags: (result, _error, chatId) =>
        result
          ? [
              ...result.map((m) => ({ type: "Message" as const, id: m.id })),
              { type: "Message", id: chatId }, { type: "Message", id: "LIST" },
            ]
          : [{ type: "Message", id: chatId }, { type: "Message", id: "LIST" }],
    }),

    sendMessage: builder.mutation<
      void,
      {
        chatId: string;
        toUserId: string;
        content: string;
        senderId?: string;
        tempId?: string;
      }
    >({
      queryFn: async () => ({ data: { success: true } }),
      async onQueryStarted(
        { chatId, toUserId, content, senderId, tempId },
        { dispatch }
      ) {
        const optimisticId =
          tempId ||
          (globalThis.crypto && "randomUUID" in globalThis.crypto
            ? globalThis.crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`);
        const optimisticMessage: ChatMessage = {
          id: optimisticId,
          tempId: optimisticId,
          chat_id: chatId,
          sender_id: senderId ?? "",
          content,
          created_at: new Date().toISOString(),
          status: "sending",
        };

        dispatch(
          messagesApi.util.updateQueryData("getMessages", chatId, (draft) => {
            draft.push(optimisticMessage);
          })
        );

        // Trigger backend send in background
        try {
          const result = await sendMessageEdge({ toUserId, content });
          
          // Replace optimistic message with real one from API (already decrypted)
          if (result?.message) {
            dispatch(
              messagesApi.util.updateQueryData("getMessages", chatId, (draft) => {
                const idx = draft.findIndex((m) => m.tempId === optimisticId);
                if (idx >= 0) {
                  draft[idx] = { ...result.message, status: "sent" };
                }
              })
            );
          }
        } catch (error) {
          dispatch(
            messagesApi.util.updateQueryData("getMessages", chatId, (draft) => {
              const msg = draft.find((m) => m.tempId === optimisticId);
              if (msg) {
                msg.status = "failed";
              }
            })
          );
        }
      },
    }),
  }),
});

export const {
  useGetMessagesQuery,
  useSendMessageMutation,
  useGetChatsQuery,
  useGetMatchesQuery,
  util: messagesUtil,
} = messagesApi;

// Realtime integration
export function attachChatRealtime(chatId: string, dispatch: any, userId?: string) {
  if (!chatId) return () => Promise.resolve("ok" as const);
  
  const unsubscribe = subscribeToChatMessages(chatId, async (message) => {
    // If this message is from me, it was already handled by the optimistic update
    if (userId && message.sender_id === userId) {
      console.log("[Realtime] Skipping own message (already handled optimistically)");
      return;
    }
    
    // Message from another user - fetch to get decrypted content
    console.log("[Realtime] New message from other user, fetching decrypted content");
    
    try {
      const result = await dispatch(
        messagesApi.endpoints.getMessages.initiate(chatId, { forceRefetch: true })
      );
      result.unsubscribe();
    } catch (error) {
      console.error("[Realtime] Failed to fetch new message:", error);
    }
  });

  return unsubscribe;
}

export function attachMatchOverviewRealtime(dispatch: any) {
  const channel = subscribeToMatchOverview(() => {
    dispatch(messagesApi.util.invalidateTags([{ type: "Match", id: "LIST" }]));
  });
  return channel;
}

export function attachChatListRealtime(dispatch: any) {
  const channel = subscribeToChatList((event: ChatListChange) => {
    const userId = getCurrentUserId();

    if (event.type === "message") {
      if (event?.message?.sender_id !== userId) {
        dispatch(
          messagesApi.util.invalidateTags([
            { type: "Message", id: event.message.chat_id },
          ])
        );
      }
    }

    dispatch(messagesApi.util.invalidateTags([{ type: "Chat", id: "LIST" }]));
    dispatch(
      messagesApi.endpoints.getChats.initiate(undefined, {
        forceRefetch: true,
        subscribe: false,
      })
    );
  });
  return channel;
}
