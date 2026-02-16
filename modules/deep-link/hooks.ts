import { usePlaceClick } from "@/hooks/use-place-click";
import { ANALYTICS_EVENTS, trackEvent } from "@/modules/analytics";
import { logger } from "@/utils/logger";
import messaging, {
  type FirebaseMessagingTypes,
} from "@react-native-firebase/messaging";

import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef } from "react";

import { resolveDeepLink } from "./resolver";
import type { DeepLinkAction, FCMDataPayload } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// useNotificationDeepLink — central hook for notification tap handling
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handles notification tap deep linking for:
 * - Cold start (app killed → getInitialNotification)
 * - Warm start (app backgrounded → onNotificationOpenedApp)
 *
 * Mount this hook inside AppConfigGuard so that the navigation tree
 * (RootNavigator) is guaranteed to be mounted when this runs.
 */
export function useNotificationDeepLink() {
  const router = useRouter();
  const { handlePlaceClick } = usePlaceClick();
  const hasProcessedInitial = useRef(false);

  // ── Navigate based on DeepLinkAction ────────────────────────────────────
  const executeDeepLink = useCallback(
    async (action: DeepLinkAction) => {
      logger.log("[DeepLink] Executing action:", action.type);

      trackEvent(ANALYTICS_EVENTS.NOTIFICATION.OPENED, {
        type: action.type,
        ...(action.type === "place_activity" || action.type === "place_planning"
          ? { placeId: action.placeId }
          : {}),
      });

      switch (action.type) {
        // ── Place Activity → handlePlaceClick (check-in flow) ──────────────
        case "place_activity": {
          try {
            await handlePlaceClick({
              placeId: action.placeId,
              name: action.placeName,
              latitude: action.latitude,
              longitude: action.longitude,
            });
          } catch (err) {
            logger.error("[DeepLink] Error handling place activity:", err);
          }
          break;
        }

        // ── Place Planning → open create-plan modal ────────────────────────
        case "place_planning": {
          router.push({
            pathname: "/(modals)/create-plan",
            params: {
              placeId: action.placeId,
              placeName: action.placeName,
            },
          });
          break;
        }

        // ── Match Created → Chat tab (chatId not available in payload) ──────
        case "match_created": {
          router.replace("/(tabs)/(chat)");
          break;
        }

        // ── Message Received → Chat conversation ──────────────────────────
        case "message_received": {
          router.replace("/(tabs)/(chat)");
          break;
        }

        // ── Like Received → Chat list ─────────────────────────────────────
        case "like_received": {
          router.replace("/(tabs)/(chat)");
          break;
        }
      }
    },
    [router, handlePlaceClick],
  );

  // ── Process FCM RemoteMessage ───────────────────────────────────────────
  const processNotification = useCallback(
    (
      remoteMessage: FirebaseMessagingTypes.RemoteMessage | null,
      source: string,
    ) => {
      if (!remoteMessage?.data) {
        logger.log(`[DeepLink] No data in ${source} notification`);
        return;
      }

      logger.log(`[DeepLink] Processing ${source} notification:`, {
        type: remoteMessage.data.type,
        placeId: remoteMessage.data.place_id,
      });

      const action = resolveDeepLink(
        remoteMessage.data as unknown as FCMDataPayload,
      );
      if (action) {
        executeDeepLink(action);
      }
    },
    [executeDeepLink],
  );

  // ── Cold Start: getInitialNotification ──────────────────────────────────
  // This hook mounts inside AppConfigGuard, so the navigation tree
  // (RootNavigator + SessionProvider) is already mounted.
  // We still add a delay for the index.tsx → /(tabs)/(home) redirect to settle.
  useEffect(() => {
    if (hasProcessedInitial.current) return;

    const checkInitialNotification = async () => {
      try {
        const remoteMessage = await messaging().getInitialNotification();
        if (remoteMessage) {
          hasProcessedInitial.current = true;

          logger.log("[DeepLink] Cold start notification found:", {
            type: remoteMessage.data?.type,
            placeId: remoteMessage.data?.place_id,
          });

          // Delay to let the root index redirect to /(tabs)/(home) settle
          setTimeout(() => {
            processNotification(remoteMessage, "cold_start");
          }, 1500);
        }
      } catch (err) {
        logger.error("[DeepLink] Error checking initial notification:", err);
      }
    };

    checkInitialNotification();
  }, [processNotification]);

  // ── Warm Start: onNotificationOpenedApp ─────────────────────────────────
  useEffect(() => {
    const unsubscribe = messaging().onNotificationOpenedApp(
      (remoteMessage) => {
        processNotification(remoteMessage, "background");
      },
    );

    return unsubscribe;
  }, [processNotification]);
}
