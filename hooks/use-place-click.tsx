import { MapPinIcon } from "@/assets/icons";
import { useCustomBottomSheet } from "@/components/BottomSheetProvider/hooks";
import {
  ConnectionBottomSheet,
  VenueState,
} from "@/components/connection-bottom-sheet";
import { PowerUpBottomSheet } from "@/components/power-up-bottom-sheet";
import { ANALYTICS_EVENTS, trackEvent } from "@/modules/analytics";
import { useUserSubscription } from "@/modules/iap/hooks";
import { enterPlace } from "@/modules/presence/api";
import { logger } from "@/utils/logger";
import { useRouter } from "expo-router";
import React, { useCallback } from "react";
import { useCachedLocation } from "./use-cached-location";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PlaceInteractionParams {
  placeId: string;
  name?: string;
  latitude: number;
  longitude: number;
  distance?: number;
  active_users?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function usePlaceClick() {
  const bottomSheet = useCustomBottomSheet();
  const router = useRouter();
  const { location: userLocation } = useCachedLocation();
  const { checkinCredits } = useUserSubscription();

  // ───────────────────────────────────────────────────────────────────────────
  // Navigation helpers
  // ───────────────────────────────────────────────────────────────────────────

  const navigateToPlacePeople = useCallback(
    (placeId: string, placeName: string, distance?: number) => {
      const distanceKm = distance ?? 0;
      router.push({
        pathname: "/(modals)/place-people",
        params: {
          placeId,
          placeName,
        },
      });
    },
    [router],
  );

  const navigateToPremiumPaywall = useCallback(() => {
    bottomSheet?.close();
    router.push("/(modals)/premium-paywall");
  }, [bottomSheet, router]);

  const tryEnterPlace = useCallback(
    async (params: PlaceInteractionParams, useCheckinPlus: boolean) => {
      return await enterPlace({
        placeId: params.placeId,
        userLat: userLocation?.latitude || 0,
        userLng: userLocation?.longitude || 0,
        placeLat: params.latitude,
        placeLng: params.longitude,
        isCheckinPlus: useCheckinPlus,
      });
    },
    [userLocation],
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Bottom Sheet Actions
  // ───────────────────────────────────────────────────────────────────────────

  const showPowerUpSheet = useCallback(
    (placeId?: string) => {
      if (!bottomSheet) return;

      logger.log("[PlaceClick] Showing PowerUp purchase sheet");

      // Track credits purchase sheet shown
      trackEvent(ANALYTICS_EVENTS.CHECKIN_FLOW.CREDITS_PURCHASE_SHOWN, {
        placeId: placeId || "unknown",
        hasCredits: checkinCredits > 0,
        creditsCount: checkinCredits,
      });

      bottomSheet.expand({
        content: () => (
          <PowerUpBottomSheet
            translationKey="screens.profile.powerUps.earlyCheckin"
            powerUpType="earlyCheckin"
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
            onPurchaseComplete={() => {
              logger.log("[PlaceClick] Check-in+ purchase completed");
              bottomSheet.close();
            }}
            onUpgradeToPremium={navigateToPremiumPaywall}
          />
        ),
        draggable: true,
      });
    },
    [bottomSheet, navigateToPremiumPaywall],
  );

  const handleConnectionBottomSheet = useCallback(
    (params: PlaceInteractionParams, venueState: VenueState) => {
      if (!bottomSheet) return;

      logger.log("[PlaceClick] Showing connection sheet:", venueState);

      // Handler for the main "Connect" button (normal entry without check-in+)
      const handleConnect = async () => {
        // Track check-in attempt
        trackEvent(ANALYTICS_EVENTS.CHECKIN_FLOW.CHECKIN_ATTEMPTED, {
          placeId: params.placeId,
          distance: params.distance || 0,
          activeUsers: params.active_users || 0,
          usedCheckinPlus: false,
        });

        // Try normal entry - backend will validate distance
        const result = await tryEnterPlace(params, false);

        if (result) {
          // Track success
          trackEvent(ANALYTICS_EVENTS.CHECKIN_FLOW.CHECKIN_SUCCESS, {
            placeId: params.placeId,
            distance: params.distance || 0,
            usedCheckinPlus: false,
          });

          bottomSheet.close();
          navigateToPlacePeople(
            params.placeId,
            params.name || "Unknown",
            params.distance,
          );
        } else {
          // Track failure
          trackEvent(ANALYTICS_EVENTS.CHECKIN_FLOW.CHECKIN_FAILED, {
            placeId: params.placeId,
            distance: params.distance || 0,
            reason: "too_far",
          });

          // Entry failed - show purchase flow
          showPowerUpSheet(params.placeId);
        }
      };

      // Handler for "Enter with Check-in+" button
      const handlePremiumPress = async () => {
        logger.log("[PlaceClick] onPremiumPress, credits:", checkinCredits);

        // Track check-in+ sheet shown
        trackEvent(ANALYTICS_EVENTS.CHECKIN_FLOW.CHECKIN_PLUS_SHOWN, {
          placeId: params.placeId,
          distance: params.distance || 0,
          hasCredits: checkinCredits > 0,
        });

        if (checkinCredits > 0) {
          // Track credit usage attempt
          trackEvent(ANALYTICS_EVENTS.CHECKIN_FLOW.CHECKIN_ATTEMPTED, {
            placeId: params.placeId,
            distance: params.distance || 0,
            activeUsers: params.active_users || 0,
            usedCheckinPlus: true,
          });

          trackEvent(ANALYTICS_EVENTS.CHECKIN_FLOW.CHECKIN_PLUS_USED, {
            placeId: params.placeId,
            remainingCredits: checkinCredits - 1,
          });

          const result = await tryEnterPlace(params, true);

          if (result) {
            // Track success with check-in+
            trackEvent(ANALYTICS_EVENTS.CHECKIN_FLOW.CHECKIN_SUCCESS, {
              placeId: params.placeId,
              distance: params.distance || 0,
              usedCheckinPlus: true,
            });

            bottomSheet.close();
            // Navigate directly to place-people after successful check-in+
            navigateToPlacePeople(
              params.placeId,
              params.name || "Unknown",
              params.distance,
            );
          } else {
            logger.warn("[PlaceClick] Entry failed even with credits");
            trackEvent(ANALYTICS_EVENTS.CHECKIN_FLOW.CHECKIN_FAILED, {
              placeId: params.placeId,
              distance: params.distance || 0,
              reason: "unknown_error",
            });
            showPowerUpSheet(params.placeId);
          }
        } else {
          showPowerUpSheet(params.placeId);
        }
      };

      bottomSheet.expand({
        content: () => (
          <ConnectionBottomSheet
            venueName={params.name}
            venueState={venueState}
            onConnect={handleConnect}
            onCancel={() => bottomSheet.close()}
            onClose={() => bottomSheet.close()}
            onPremiumPress={handlePremiumPress}
          />
        ),
        draggable: true,
      });
    },
    [
      bottomSheet,
      checkinCredits,
      navigateToPlacePeople,
      showPowerUpSheet,
      tryEnterPlace,
    ],
  );

  const handlePlaceClick = useCallback(
    async (params: PlaceInteractionParams) => {
      logger.log("[PlaceClick] handlePlaceClick", params.placeId, {
        distance: params.distance,
      });

      // Track place people navigation initiated
      trackEvent(ANALYTICS_EVENTS.CHECKIN_FLOW.PLACE_PEOPLE_NAVIGATED, {
        placeId: params.placeId,
        distance: params.distance || 0,
        activeUsers: params.active_users || 0,
      });

      if (!bottomSheet) {
        logger.warn("[PlaceClick] No bottomSheet available");
        return;
      }

      if (!userLocation?.latitude || !userLocation?.longitude) {
        logger.info("[PlaceClick] Missing user location, forcing locked state");
        handleConnectionBottomSheet(params, "locked");
        return;
      }

      // First, try to enter without check-in+ (will succeed if user has active presence or is close)
      const result = await tryEnterPlace(params, false);

      if (result) {
        // User has active presence or entered successfully - go directly to place-people
        logger.log(
          "[PlaceClick] Entry successful (existing presence or close), navigating",
        );
        bottomSheet?.close();
        navigateToPlacePeople(
          params.placeId,
          params.name || "Unknown",
          params.distance,
        );
        return;
      }

      // Entry failed - show appropriate bottom sheet
      logger.log("[PlaceClick] Entry failed, showing locked sheet");
      handleConnectionBottomSheet(params, "locked");
    },
    [
      bottomSheet,
      userLocation,
      handleConnectionBottomSheet,
      navigateToPlacePeople,
      tryEnterPlace,
    ],
  );

  return {
    handlePlaceClick,
    navigateToPlacePeople,
  };
}
