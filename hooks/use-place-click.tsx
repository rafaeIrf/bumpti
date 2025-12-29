import { MapPinIcon } from "@/assets/icons";
import { useCustomBottomSheet } from "@/components/BottomSheetProvider/hooks";
import {
  ConnectionBottomSheet,
  VenueState,
} from "@/components/connection-bottom-sheet";
import { PowerUpBottomSheet } from "@/components/power-up-bottom-sheet";
import { enterPlace } from "@/modules/presence/api";
import { formatDistance } from "@/utils/distance";
import { useRouter } from "expo-router";
import React, { useCallback } from "react";
import { useCachedLocation } from "./use-cached-location";

export interface PlaceInteractionParams {
  placeId: string;
  name: string;
  latitude: number;
  longitude: number;
  distance: number;
  active_users?: number;
}

export function usePlaceClick() {
  const bottomSheet = useCustomBottomSheet();
  const router = useRouter();
  const { location: userLocation } = useCachedLocation();

  const navigateToPlacePeople = useCallback(
    (placeId: string, placeName: string, distance: number) => {
      router.push({
        pathname: "/(modals)/place-people",
        params: {
          placeId,
          placeName,
          distance: formatDistance(distance),
          distanceKm: distance.toString(),
        },
      });
    },
    [router]
  );

  const handleConnectionBottomSheet = useCallback(
    (params: PlaceInteractionParams, venueState: VenueState) => {
      if (!bottomSheet) return;

      const isClose = params.distance <= 0.1;

      const showPowerUp = () => {
        bottomSheet.close();
        setTimeout(() => {
          bottomSheet.expand({
            content: () => (
              <PowerUpBottomSheet
                translationKey="screens.profile.powerUps.earlyCheckin"
                icon={MapPinIcon}
                options={[
                  { quantity: 1, id: "single" },
                  {
                    quantity: 5,
                    id: "bundle",
                    badgeId: "popular",
                    isHighlighted: true,
                  },
                  { quantity: 10, id: "max" },
                ]}
                onClose={() => bottomSheet.close()}
                onPurchase={(quantity) => {
                  console.log("Purchase earlyCheckin", quantity);
                  bottomSheet.close();
                }}
                onUpgradeToPremium={() => {
                  bottomSheet.close();
                  router.push("/(modals)/premium-paywall");
                }}
              />
            ),
            draggable: true,
          });
        }, 300);
      };

      bottomSheet.expand({
        content: () => (
          <ConnectionBottomSheet
            venueName={params.name}
            venueState={venueState}
            onConnect={async () => {
              // Try to enter. Use is_checkin_plus if we are FAR.
              const result = await enterPlace({
                placeId: params.placeId,
                userLat: userLocation?.latitude || 0,
                userLng: userLocation?.longitude || 0,
                placeLat: params.latitude,
                placeLng: params.longitude,
                isCheckinPlus: !isClose, // If far, use the bypass
              });

              if (result) {
                bottomSheet.close();
                navigateToPlacePeople(
                  params.placeId,
                  params.name,
                  params.distance
                );
              } else {
                // If enterPlace fails (even with checkin plus, likely no credits or API error)
                // Transition to buy flow
                showPowerUp();
              }
            }}
            onCancel={() => {
              bottomSheet.close();
            }}
            onClose={() => {
              bottomSheet.close();
            }}
            onPremiumPress={() => {
              if (venueState === "locked") {
                // Transition to preview (active or quiet)
                const nextState =
                  (params.active_users ?? 0) > 0 ? "active" : "quiet";
                handleConnectionBottomSheet(params, nextState);
              } else {
                showPowerUp();
              }
            }}
          />
        ),
        draggable: true,
      });
    },
    [bottomSheet, router, navigateToPlacePeople, userLocation]
  );

  const handlePlaceClick = useCallback(
    async (params: PlaceInteractionParams) => {
      if (!bottomSheet) return;

      if (!userLocation?.latitude || !userLocation?.longitude) {
        handleConnectionBottomSheet(params, "locked");
        return;
      }

      // GATE 1: Distance (Always the first priority)
      const isClose = params.distance <= 0.1; // 100m local check

      if (isClose) {
        // NEAR FLOW: Attempt direct entry
        const result = await enterPlace({
          placeId: params.placeId,
          userLat: userLocation.latitude,
          userLng: userLocation.longitude,
          placeLat: params.latitude,
          placeLng: params.longitude,
        });

        if (result) {
          navigateToPlacePeople(params.placeId, params.name, params.distance);
          return;
        }

        // Server-side distance check failed (stricter 60m rule)
        handleConnectionBottomSheet(params, "locked");
        return;
      }

      // FAR FLOW: Always show locked first, even if empty.
      // (The preview to 'quiet' or 'active' happens via onPremiumPress inside the sheet)
      handleConnectionBottomSheet(params, "locked");
    },
    [
      bottomSheet,
      userLocation,
      handleConnectionBottomSheet,
      navigateToPlacePeople,
    ]
  );

  return {
    handlePlaceClick,
  };
}
