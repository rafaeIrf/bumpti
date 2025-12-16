import {
  messagesApi,
  useGetChatsQuery,
  useGetMatchesQuery,
} from "@/modules/chats/messagesApi";
import { store } from "@/modules/store";
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

    // Debounce the prefetch to allow realtime updates (from message.tsx) to settle in the cache first.
    // If we run immediately, we might check the cache before the optimistic update lands, triggering a redundant fetch.
    const timer = setTimeout(() => {
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
      chats.forEach((chat) => {
        // Check if we already have the latest data in cache to avoid redundant fetches
        // active chat screens update cache via realtime, so we don't want to overwrite/refetch if it's already there
        
        // Access current cache state
        const state = store.getState();
        const cacheEntry = messagesApi.endpoints.getMessages.select({ 
          chatId: chat.chat_id, 
          cursor: undefined 
        })(state);
        
        const cachedMessages = cacheEntry.data?.messages || [];
        const latestCachedMessage = cachedMessages.length > 0 
          ? cachedMessages[cachedMessages.length - 1] // Assuming standard order (oldest -> newest)
          : null;

        // Determine if cache is fresh enough
        // Condition: verify if the latest message timestamp in summary matches the latest in cache
        const isCacheFresh = latestCachedMessage && chat.last_message_at && 
          new Date(latestCachedMessage.created_at).getTime() >= new Date(chat.last_message_at).getTime();

        const shouldRefetch = chat.unread_count && chat.unread_count > 0 && !isCacheFresh;

        // If we don't need to refetch, we can still initiate to ensure subscription/access, 
        // but without 'forceRefetch', saving the network call if data exists.
        console.log('getm shouldRefetch', shouldRefetch);
        dispatch(
          messagesApi.endpoints.getMessages.initiate(
            { chatId: chat.chat_id, cursor: undefined },
            { forceRefetch: !!shouldRefetch }
          )
        );
      });
    }, 1000); // 1s delay to let Redux settle

    return () => clearTimeout(timer);
  }, [chats, matches, isLoading, dispatch]);
}

