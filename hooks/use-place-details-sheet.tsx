import { useCustomBottomSheet } from "@/components/BottomSheetProvider/hooks";
import { PlaceDetailsBottomSheet } from "@/components/place-details-bottom-sheet";
import { useFavoriteToggle } from "@/hooks/use-favorite-toggle";
import { usePlaceClick } from "@/hooks/use-place-click";
import { t } from "@/modules/locales";
import { Place } from "@/modules/places/types";
import { formatDistance } from "@/utils/distance";
import { logger } from "@/utils/logger";
import { openMapsWithChooser } from "@/utils/maps-utils";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";

interface UsePlaceDetailsSheetOptions {
  queryArg?: { lat?: number; lng?: number };
}

// Wrapper component defined at module level to avoid Hooks violations
function PlaceDetailsWrapper({
  place,
  category,
  favoriteIds,
  favoritesCount,
  onToggleFavorite,
  onClose,
  onRate,
  onConnect,
  onReport,
}: {
  place: Place;
  category: string;
  favoriteIds: Set<string>;
  favoritesCount: number;
  onToggleFavorite: (
    id: string,
    opts?: {
      optimisticOnly?: boolean;
      sync?: boolean;
      value?: boolean;
      place?: Place;
      details?: { name: string; emoji?: string };
    },
  ) => void;
  onClose: () => void;
  onRate: () => void;
  onConnect: (placeData: {
    placeId: string;
    name: string;
    latitude: number;
    longitude: number;
    distance: number;
    active_users?: number;
  }) => Promise<void>;
  onReport: () => void;
}) {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    logger.log("[PlaceDetails] onConnect triggered", place.placeId);
    setIsConnecting(true);

    try {
      await onConnect({
        placeId: place.placeId,
        name: place.name,
        latitude: place.latitude,
        longitude: place.longitude,
        distance: place.distance,
        active_users: place.active_users,
      });
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <PlaceDetailsBottomSheet
      placeName={place.name}
      placeId={place.placeId}
      category={category}
      categoryKey={place.types?.[0]}
      address={place.formattedAddress || ""}
      neighborhood={place.neighborhood}
      distance={formatDistance(place.distance)}
      review={place.review}
      activeUsers={place.active_users}
      regularsCount={place.regulars_count}
      isFavorite={favoriteIds.has(place.placeId)}
      favoritesCount={favoritesCount}
      onNavigate={() => {
        openMapsWithChooser({
          name: place.name,
          formattedAddress: place.formattedAddress,
          lat: place.latitude,
          lng: place.longitude,
        });
      }}
      onToggleFavorite={(id, opts) =>
        onToggleFavorite(id, {
          ...opts,
          place: place,
          details: { name: place.name, emoji: (place as any).emoji },
        })
      }
      onConnect={handleConnect}
      isLoading={isConnecting}
      onClose={onClose}
      onRate={onRate}
      onReport={onReport}
    />
  );
}

/**
 * Hook to show PlaceDetailsBottomSheet for a place.
 * Reusable across category-results, place-search, and other screens.
 */
export function usePlaceDetailsSheet(
  options: UsePlaceDetailsSheetOptions = {},
) {
  const router = useRouter();
  const bottomSheet = useCustomBottomSheet();
  const { favoriteIds, handleToggle } = useFavoriteToggle(options.queryArg);
  const { handlePlaceClick } = usePlaceClick();

  const showPlaceDetails = useCallback(
    (place: Place) => {
      if (!bottomSheet) return;

      const category = place.types?.[0]
        ? t(`place.categories.${place.types[0]}`)
        : t("common.place");

      bottomSheet.expand({
        content: () => (
          <PlaceDetailsWrapper
            place={place}
            category={category}
            favoriteIds={favoriteIds}
            favoritesCount={favoriteIds.size}
            onToggleFavorite={handleToggle}
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
            onConnect={handlePlaceClick}
            onReport={() => {
              bottomSheet.close();
              router.push({
                pathname: "/(modals)/place-report",
                params: {
                  placeId: place.placeId,
                  placeName: place.name,
                },
              });
            }}
          />
        ),
        draggable: true,
      });
    },
    [bottomSheet, favoriteIds, handleToggle, router, handlePlaceClick],
  );

  return {
    showPlaceDetails,
    favoriteIds,
    handleToggle,
  };
}
