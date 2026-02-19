import DetectionStore from "@/modules/places/detection-store";
import { useDetectPlaceQuery } from "@/modules/places/placesApi";
import { logger } from "@/utils/logger";
import { useCallback, useEffect, useState } from "react";

interface DetectedPlace {
  id: string;
  name: string;
  category?: string;
  active_users?: number;
  preview_avatars?: { user_id: string; url: string }[];
}


interface UseDetectionBannerParams {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  enabled?: boolean;
}

interface UseDetectionBannerResult {
  place: DetectedPlace | null;
  isVisible: boolean;
  dismiss: () => void;
}

/**
 * Hook to manage detection banner logic
 *
 * Handles:
 * - Fetching place candidates from RPC
 * - Checking dismissal state
 * - Enforcing global cooldown
 * - Initializing detection store on mount
 *

 */
export function useDetectionBanner({
  latitude,
  longitude,
  accuracy,
  enabled = true,
}: UseDetectionBannerParams): UseDetectionBannerResult {
  const [visiblePlace, setVisiblePlace] = useState<DetectedPlace | null>(null);

  // Initialize detection store on mount
  useEffect(() => {
    DetectionStore.initialize();
  }, []);

  // Query for detected place
  const { data: detectedPlaceResult } = useDetectPlaceQuery(
    {
      latitude: latitude ?? 0,
      longitude: longitude ?? 0,
      hacc: accuracy,
    },
    {
      skip: !enabled || !latitude || !longitude,
    },
  );

  // Process detection result
  useEffect(() => {

    const processDetection = async () => {
      const detected = detectedPlaceResult?.suggested;

      if (!detected) {
        setVisiblePlace(null);
        return;
      }

      try {
        // Check global cooldown (30 seconds for testing - TODO: increase to 15 minutes in production)
        const lastShown = await DetectionStore.getLastShownAt();
        const canShow = await DetectionStore.canShowBanner(0.5); // 0.5 minutes = 30 seconds

        logger.log(
          `Detection banner: last_shown_at=${lastShown ? new Date(lastShown).toISOString() : "never"}, canShow=${canShow}`,
        );

        if (!canShow) {
          logger.log(
            "Detection banner: Global cooldown active, skipping display",
          );
          setVisiblePlace(null);
          return;
        }

        // Check if place was recently dismissed (12 hours)
        const isDismissed = await DetectionStore.isDismissed(detected.id, 12);
        if (isDismissed) {
          logger.log(
            `Detection banner: Place ${detected.name} was recently dismissed`,
          );
          setVisiblePlace(null);
          return;
        }

        // All checks passed - show banner and update cooldown
        logger.log(`Detection banner: Showing for ${detected.name}`);
        await DetectionStore.setLastShownAt(); // Start global cooldown when banner appears
        setVisiblePlace(detected); // Pass complete object with all properties
      } catch (error) {
        logger.error("Error processing detection:", error);
        setVisiblePlace(null);
      }
    };

    processDetection();
  }, [detectedPlaceResult]);

  const dismiss = useCallback(async () => {

    if (visiblePlace) {
      await DetectionStore.dismissPlace(visiblePlace.id);
      logger.log(`Banner dismissed for ${visiblePlace.name}`);
    }
    setVisiblePlace(null);
  }, [visiblePlace]);

  return {
    place: visiblePlace,
    isVisible: visiblePlace !== null,
    dismiss,
  };
}
