import { useGetPendingLikesQuery } from "@/modules/pendingLikes/pendingLikesApi";
import { useAppSelector } from "@/modules/store/hooks";

export function usePendingLikesPrefetch() {
  const profileId = useAppSelector((state) => state.profile.data?.id);

  useGetPendingLikesQuery(undefined, {
    skip: !profileId,
    refetchOnFocus: false,
    refetchOnReconnect: true,
  });
}
