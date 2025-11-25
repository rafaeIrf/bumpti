import { useCallback, useMemo } from "react";
import { useAppSelector } from "@/modules/store/hooks";
import { favoritesActions } from "@/modules/store/slices";

type ToggleOptions = { optimisticOnly?: boolean; sync?: boolean; value?: boolean };

export function useFavoriteToggle() {
  const favorites = useAppSelector((state) => state.favorites.placeIds);

  const favoriteIds = useMemo(() => new Set(favorites), [favorites]);

  const handleToggle = useCallback(
    (placeId: string, options?: ToggleOptions) => {
      const desiredValue =
        typeof options?.value === "boolean"
          ? options.value
          : favoriteIds.has(placeId);

      if (options?.optimisticOnly) {
        if (desiredValue) {
          favoritesActions.addFavoriteLocal(placeId);
        } else {
          favoritesActions.removeFavoriteLocal(placeId);
        }
        return;
      }

      if (options?.sync) {
        favoritesActions.toggleFavorite(placeId, desiredValue);
      }
    },
    [favoriteIds]
  );

  return { favoriteIds, handleToggle };
}
