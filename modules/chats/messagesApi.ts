import {
  getChats as fetchChats,
  getMatches as fetchMatches,
  getMessages as fetchMessages,
  markMessagesRead,
  sendMessage as sendMessageEdge,
} from "@/modules/chats/api";
import {
  ChatListChange,
  subscribeToChatList,
  subscribeToChatMessages,
  subscribeToMatchOverview,
} from "@/modules/chats/realtime";
import { ActiveUserAtPlace } from "@/modules/presence/api";
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
  place_name: string | null;
  chat_created_at: string | null;
  other_user: {
    id: string;
    name: string | null;
    photo_url?: string | null;
  };
  last_message: string | null;
  last_message_at: string | null;
  unread_count?: number;
  first_message_at: string | null;
  other_user_profile?: ActiveUserAtPlace | null;
};

export type MatchSummary = {
  match_id: string;
  chat_id: string | null;
  matched_at: string | null;
  place_id: string | null;
  place_name: string | null;
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

    getMessages: builder.query<
      {
        messages: ChatMessage[];
        hasMore: boolean;
        nextCursor: string | null;
        other_user_profile?: ActiveUserAtPlace | null;
      },
      { chatId: string; cursor?: string }
    >({
      queryFn: async ({ chatId, cursor }) => {
        try {
          const data = await fetchMessages({
            chatId,
            limit: 50,
            before: cursor,
          });
          const messages =
            data.messages?.map((m) => ({ ...m, status: "sent" as const })) ??
            [];
          return {
            data: {
              messages,
              hasMore: data.has_more,
              nextCursor: data.next_cursor,
              other_user_profile: data.other_user_profile ?? null,
            },
          };
        } catch (error) {
          return { error: { status: "CUSTOM_ERROR", error: String(error) } };
        }
      },
      serializeQueryArgs: ({ queryArgs }) => {
        // Only use chatId for cache key, ignore cursor
        return queryArgs.chatId;
      },
      merge: (currentCache, newResponse, { arg }) => {
        // If cursor exists, we're loading more - prepend old messages
        if (arg.cursor) {
          const combinedMessages = [...newResponse.messages, ...currentCache.messages];
          // Deduplicate by id (keep first occurrence)
          const seen = new Set<string>();
          const uniqueMessages = combinedMessages.filter((msg) => {
            if (seen.has(msg.id)) return false;
            seen.add(msg.id);
            return true;
          });
          return {
            messages: uniqueMessages,
            hasMore: newResponse.hasMore,
            nextCursor: newResponse.nextCursor,
            other_user_profile: currentCache.other_user_profile,
          };
        }
        // Initial load or refresh
        return newResponse;
      },
      forceRefetch: ({ currentArg, previousArg }) => {
        // Force refetch when cursor changes
        return currentArg?.cursor !== previousArg?.cursor;
      },
      providesTags: (result, _error, { chatId }) =>
        result
          ? [
              ...result.messages.map((m) => ({ type: "Message" as const, id: m.id })),
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

        // If retrying, update existing failed message to sending status
        // Otherwise, add new optimistic message
        if (tempId) {
          dispatch(
            messagesApi.util.updateQueryData("getMessages", { chatId, cursor: undefined }, (draft) => {
              const msg = draft.messages.find((m) => m.tempId === tempId || m.id === tempId);
              if (msg) {
                msg.status = "sending";
              }
            })
          );
        } else {
          dispatch(
            messagesApi.util.updateQueryData("getMessages", { chatId, cursor: undefined }, (draft) => {
              draft.messages.push(optimisticMessage);
            })
          );
        }

        // Trigger backend send in background
        try {
          const result = await sendMessageEdge({ toUserId, content });
          
          // Replace optimistic message with real one from API (already decrypted)
          if (result?.message) {
            dispatch(
              messagesApi.util.updateQueryData("getMessages", { chatId, cursor: undefined }, (draft) => {
                const idx = draft.messages.findIndex((m) => m.tempId === optimisticId || m.id === optimisticId);
                if (idx >= 0) {
                  // Remove optimistic message
                  draft.messages.splice(idx, 1);
                }
                // Add real message from server
                draft.messages.push({ ...result.message, status: "sent" });
                
                // Sort messages by created_at to ensure correct order even if responses arrive out of order
                draft.messages.sort((a, b) => 
                  new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                );
              })
            );
          }
        } catch (error) {
          dispatch(
            messagesApi.util.updateQueryData("getMessages", { chatId, cursor: undefined }, (draft) => {
              const msg = draft.messages.find((m) => m.tempId === optimisticId || m.id === optimisticId);
              if (msg) {
                msg.status = "failed";
              }
            })
          );
        }
      },
    }),

    markMessagesRead: builder.mutation<null, { chatId: string }>({
      queryFn: async ({ chatId }) => {
        try {
          await markMessagesRead({ chatId });
          return { data: null };
        } catch (error) {
          return { error: { status: "CUSTOM_ERROR", error: String(error) } };
        }
      },
      async onQueryStarted({ chatId }, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          messagesApi.util.updateQueryData("getChats", undefined, (draft) => {
            const chat = draft.find((c) => c.chat_id === chatId);
            if (chat) {
              chat.unread_count = 0;
            }
          })
        );
        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
    }),
  }),
});

export const {
  useGetMessagesQuery,
  useSendMessageMutation,
  useMarkMessagesReadMutation,
  useGetChatsQuery,
  useGetMatchesQuery,
  util: messagesUtil,
} = messagesApi;

// Realtime integration
export function attachChatRealtime(chatId: string, dispatch: any, userId: string) {
  if (!chatId || !userId) {
    console.warn('[Realtime] Cannot attach realtime without chatId and userId');
    return () => Promise.resolve("ok" as const);
  }
  
  const unsubscribe = subscribeToChatMessages(chatId, async (message) => {
    // If this message is from me, it was already handled by the optimistic update
    if (message.sender_id === userId) {
      console.log("[Realtime] Skipping own message (already handled optimistically)");
      return;
    }
    
    // Message from another user - fetch to get decrypted content
    console.log("[Realtime] New message from other user, fetching decrypted content");
    
    try {
      const promise = dispatch(
        messagesApi.endpoints.getMessages.initiate({ chatId, cursor: undefined }, { forceRefetch: true })
      );
      await promise;
      promise.unsubscribe();
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

export function attachChatListRealtime(dispatch: any, userId: string) {
  const channel = subscribeToChatList((event: ChatListChange) => {

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
