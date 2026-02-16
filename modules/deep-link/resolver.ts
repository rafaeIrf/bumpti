import { logger } from "@/utils/logger";

import type { DeepLinkAction, FCMDataPayload } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Resolver — pure function that parses FCM data → DeepLinkAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves an FCM data payload into a typed DeepLinkAction.
 * Returns null if the payload cannot be resolved to a known action.
 */
export function resolveDeepLink(
  data: FCMDataPayload | undefined,
): DeepLinkAction | null {
  if (!data?.type) {
    logger.warn("[DeepLink] No type in notification data");
    return null;
  }

  switch (data.type) {
    // ── Place Activity ────────────────────────────────────────────────────
    case "favorite_activity_started":
    case "favorite_activity_heating":
    case "nearby_activity_started":
    case "nearby_activity_heating": {
      if (!data.place_id) {
        logger.warn("[DeepLink] Place activity notification missing place_id");
        return null;
      }

      // Planning notifications → open create-plan screen
      if (data.has_planning === "true") {
        return {
          type: "place_planning",
          placeId: data.place_id,
          placeName: data.place_name || "",
        };
      }

      // Check-in notifications → open place details via handlePlaceClick
      const lat = parseFloat(data.place_lat || "0");
      const lng = parseFloat(data.place_lng || "0");
      if (!lat || !lng) {
        logger.warn("[DeepLink] Place activity notification missing coordinates");
        return null;
      }
      return {
        type: "place_activity",
        placeId: data.place_id,
        placeName: data.place_name || "",
        latitude: lat,
        longitude: lng,
      };
    }

    // ── Match Created ─────────────────────────────────────────────────────
    case "match_created": {
      if (!data.match_id) {
        logger.warn("[DeepLink] Match notification missing match_id");
        return null;
      }
      return {
        type: "match_created",
        matchId: data.match_id,
      };
    }

    // ── Message Received ──────────────────────────────────────────────────
    case "message_received": {
      if (!data.chat_id) {
        logger.warn("[DeepLink] Message notification missing chat_id");
        return null;
      }
      return {
        type: "message_received",
        chatId: data.chat_id,
        matchId: data.match_id,
      };
    }

    // ── Like Received ─────────────────────────────────────────────────────
    case "like_received": {
      return {
        type: "like_received",
      };
    }

    default:
      logger.warn("[DeepLink] Unknown notification type:", data.type);
      return null;
  }
}
