import { useCustomBottomSheet } from "@/components/BottomSheetProvider/hooks";
import { PlaceDetailsBottomSheet } from "@/components/place-details-bottom-sheet";
import { useFavoriteToggle } from "@/hooks/use-favorite-toggle";
import { t } from "@/modules/locales";
import { Place } from "@/modules/places/types";
import { formatDistance } from "@/utils/distance";
import { openMaps } from "@/utils/maps";
import { useRouter } from "expo-router";
import { useCallback } from "react";

interface UsePlaceDetailsSheetOptions {
  queryArg?: { lat?: number; lng?: number };
}

/**
 * Hook to show PlaceDetailsBottomSheet for a place.
 * Reusable across category-results, place-search, and other screens.
 */
export function usePlaceDetailsSheet(
  options: UsePlaceDetailsSheetOptions = {}
) {
  const router = useRouter();
  const bottomSheet = useCustomBottomSheet();
  const { favoriteIds, handleToggle } = useFavoriteToggle(options.queryArg);

  const showPlaceDetails = useCallback(
    (place: Place) => {
      if (!bottomSheet) return;

      const category = place.types?.[0]
        ? t(`place.categories.${place.types[0]}`)
        : t("common.place");

      bottomSheet.expand({
        content: () => (
          <PlaceDetailsBottomSheet
            placeName={place.name}
            placeId={place.placeId}
            category={category}
            address={place.formattedAddress || ""}
            distance={formatDistance(place.distance)}
            review={place.review}
            isFavorite={favoriteIds.has(place.placeId)}
            onNavigate={() => {
              openMaps(place.formattedAddress || place.name);
            }}
            onToggleFavorite={(id, opts) =>
              handleToggle(id, {
                ...opts,
                place: place,
                details: { name: place.name, emoji: (place as any).emoji },
              })
            }
            onClose={() => bottomSheet.close()}
            onRate={() => {
              bottomSheet.close();
              router.push({
                pathname: "/(modals)/rate-place",
                params: {
                  placeId: place.placeId,
                  name: place.name,
                  category,
                },
              });
            }}
          />
        ),
        draggable: true,
      });
    },
    [bottomSheet, favoriteIds, handleToggle, router]
  );

  return {
    showPlaceDetails,
    favoriteIds,
    handleToggle,
  };
}
