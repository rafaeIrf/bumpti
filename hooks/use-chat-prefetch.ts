import {
  messagesApi,
  useGetChatsQuery,
  useGetMatchesQuery,
} from "@/modules/chats/messagesApi";
import { useAppDispatch } from "@/modules/store/hooks";
import { prefetchImages } from "@/utils/image-prefetch";
import { useEffect } from "react";

/**
 * Hook to prefetch chat and match images in the background.
 * Separated from the component to allow for non-blocking execution.
 */
export function useChatPrefetch() {
  const dispatch = useAppDispatch();
  // Subscribe to chats and matches with auto-refresh policies
  // This ensures data is always fresh in the background (e.g. badge counts, last messages)
  const { data: chats = [], isLoading: loadingChats } = useGetChatsQuery(
    undefined,
    {
      refetchOnMountOrArgChange: true,
      refetchOnFocus: true,
    }
  );
  const { data: matches = [], isLoading: loadingMatches } = useGetMatchesQuery(
    undefined,
    {
      refetchOnMountOrArgChange: true,
      refetchOnFocus: true,
    }
  );

  const isLoading = loadingChats || loadingMatches;

  useEffect(() => {
    if (isLoading) return;

    const imageUrls: string[] = [];

    // Collect image URLs from matches (high priority - visible first)
    for (const match of matches) {
      if (match.other_user?.photo_url) {
        imageUrls.push(match.other_user.photo_url);
      }
    }

    // Collect image URLs from chats
    for (const chat of chats) {
      if (chat.other_user?.photo_url) {
        imageUrls.push(chat.other_user.photo_url);
      }
    }

    // Prefetch all images in parallel with cache policy
    if (imageUrls.length > 0) {
      prefetchImages(imageUrls).catch(() => {});
    }

    // Prefetch messages for chats
    // This primes the cache so opening the chat is instant
    // Intelligent Prefetching: Only fetch if the cache is stale compared to the list info
    // This saves bandwidth/battery by avoiding unnecessary network calls for unchanged chats
    
    chats.forEach((chat) => {
      // TODO: DO NOT CALL WHEN RECEIVING MESSAGE IN LIVE CHAT (ALREADY HANDLED IN REALTIME LISTENER)
      const shouldRefetch = chat.unread_count && chat.unread_count > 0;
      dispatch(
        messagesApi.endpoints.getMessages.initiate(
          { chatId: chat.chat_id, cursor: undefined },
          { forceRefetch: shouldRefetch }
        )
      );
    });
  }, [chats, matches, isLoading, dispatch]);
}

