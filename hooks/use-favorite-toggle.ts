import {
  useGetFavoritePlacesQuery,
  useToggleFavoritePlaceMutation,
} from "@/modules/places/placesApi";
import { useCallback, useMemo } from "react";

type ToggleOptions = { optimisticOnly?: boolean; sync?: boolean; value?: boolean };

export function useFavoriteToggle(queryArg?: { lat?: number; lng?: number }) {
  const { data } = useGetFavoritePlacesQuery(queryArg);
  const [toggleFavoritePlace] = useToggleFavoritePlaceMutation();

  const favoriteIds = useMemo(() => {
    const ids = (data?.places || []).map((p) => p.placeId || p.id);
    return new Set(ids);
  }, [data?.places]);

  const handleToggle = useCallback(
    (placeId: string, options?: ToggleOptions) => {
      const desiredValue =
        typeof options?.value === "boolean" ? options.value : !favoriteIds.has(placeId);

      if (options?.optimisticOnly) {
        // handled by caller; cache update occurs in mutation
        return;
      }

      if (options?.sync) {
        toggleFavoritePlace({
          placeId,
          action: desiredValue ? "add" : "remove",
          queryArg,
        });
      }
    },
    [favoriteIds, toggleFavoritePlace, queryArg]
  );

  return { favoriteIds, handleToggle };
}
