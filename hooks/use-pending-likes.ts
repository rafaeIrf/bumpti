import { useGetPendingLikesQuery } from "@/modules/pendingLikes/pendingLikesApi";
import { useEffect } from "react";

export function usePendingLikes() {
  const { data, isLoading, refetch, error } = useGetPendingLikesQuery(undefined, {
    // Keep data fresh on focus but don't poll aggressively
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    // no-op effect placeholder (keeps consistent lifecycle if we later need to subscribe)
  }, []);

  return {
    count: data?.count ?? 0,
    photos: data?.photos ?? [],
    loading: isLoading,
    error: (error as any)?.message ?? null,
    refresh: refetch,
  } as const;
}
