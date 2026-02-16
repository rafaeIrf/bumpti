// ─────────────────────────────────────────────────────────────────────────────
// Deep Link Actions — one variant per notification type
// ─────────────────────────────────────────────────────────────────────────────

export type DeepLinkAction =
  | {
      type: "place_activity";
      placeId: string;
      placeName: string;
      latitude: number;
      longitude: number;
    }
  | {
      type: "place_planning";
      placeId: string;
      placeName: string;
    }
  | {
      type: "match_created";
      matchId: string;
    }
  | {
      type: "message_received";
      chatId: string;
      matchId?: string;
    }
  | {
      type: "like_received";
    };

// ─────────────────────────────────────────────────────────────────────────────
// Notification types — mirrors backend NotificationType
// ─────────────────────────────────────────────────────────────────────────────

export type NotificationType =
  | "favorite_activity_started"
  | "favorite_activity_heating"
  | "nearby_activity_started"
  | "nearby_activity_heating"
  | "match_created"
  | "message_received"
  | "like_received";

// ─────────────────────────────────────────────────────────────────────────────
// FCM Data Payload — raw data from push notification
// ─────────────────────────────────────────────────────────────────────────────

export interface FCMDataPayload {
  type?: NotificationType | string;
  place_id?: string;
  place_name?: string;
  place_lat?: string;
  place_lng?: string;
  has_planning?: string;
  match_id?: string;
  chat_id?: string;
  [key: string]: string | undefined;
}
