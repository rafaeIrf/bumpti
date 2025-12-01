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
import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { getCurrentUserId } from "@/modules/store/selectors/profile";

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
          sender_id: senderId ?? "me",
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
          await sendMessageEdge({ toUserId, content });
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
  const unsubscribe = subscribeToChatMessages(chatId, (message) => {
    dispatch(
      messagesApi.util.updateQueryData("getMessages", chatId, (draft) => {
        // Replace optimistic if matches content+sender_id and status sending
        const idx = draft.findIndex(
          (m) =>
            m.status === "sending" &&
            m.content === message.content &&
            m.sender_id === message.sender_id
        );
        if (idx >= 0) {
          draft[idx] = { ...message, status: "sent" };
        } else if (!draft.some((m) => m.id === message.id)) {
          draft.push({ ...message, status: "sent" });
        }
        draft.sort(
          (a, b) =>
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime()
        );
      })
    );

    // Update chat preview and ordering
    dispatch(
      messagesApi.util.updateQueryData("getChats", undefined, (draft) => {
        const chat = draft.find((c) => c.chat_id === chatId);
        if (chat) {
          chat.last_message = message.content;
        }
        draft.sort((a, b) => {
          const aTime = a.last_message_at || "";
          const bTime = b.last_message_at || "";
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        });
      })
    );
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
