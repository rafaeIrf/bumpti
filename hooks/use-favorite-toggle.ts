import {
    useGetFavoritePlacesQuery,
    useToggleFavoritePlaceMutation,
} from "@/modules/places/placesApi";
import { useCallback, useMemo, useState } from "react";

type ToggleOptions = { optimisticOnly?: boolean; sync?: boolean; value?: boolean };

export function useFavoriteToggle(queryArg?: { lat?: number; lng?: number }) {
  const { data } = useGetFavoritePlacesQuery(queryArg);
  const [toggleFavoritePlace] = useToggleFavoritePlaceMutation();
  
  // Store optimistic overrides: placeId -> isFavorite
  const [optimisticOverrides, setOptimisticOverrides] = useState<Record<string, boolean>>({});

  // Reset overrides when real data changes to match the overrides
  // (Optional refinement, but for now simple merging is enough)
  
  const favoriteIds = useMemo(() => {
    const serverIds = new Set((data?.places || []).map((p) => p.placeId || p.id));
    
    // Apply overrides
    const result = new Set(serverIds);
    Object.entries(optimisticOverrides).forEach(([id, isFav]) => {
      if (isFav) {
        result.add(id);
      } else {
        result.delete(id);
      }
    });
    
    return result;
  }, [data?.places, optimisticOverrides]);

  const handleToggle = useCallback(
    (placeId: string, options?: ToggleOptions) => {
      // Determine new value
      const currentValue = favoriteIds.has(placeId);
      const nextValue = typeof options?.value === "boolean" ? options.value : !currentValue;

      // Update local optimistic state immediately
      setOptimisticOverrides((prev) => ({
        ...prev,
        [placeId]: nextValue,
      }));

      if (options?.optimisticOnly) {
        return;
      }

      if (options?.sync) {
        toggleFavoritePlace({
          placeId,
          action: nextValue ? "add" : "remove",
          queryArg,
        });
      }
    },
    [favoriteIds, toggleFavoritePlace, queryArg]
  );

  return { favoriteIds, handleToggle };
}
