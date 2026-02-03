/**
 * Analytics Events Catalog
 *
 * Centralized constants for all analytics events.
 * Provides type-safety and prevents typos in event names.
 *
 * Usage:
 *   trackEvent(ANALYTICS_EVENTS.TRACKING.PERMISSION_GRANTED, { screen: "onboarding" })
 */

// =============================================================================
// SESSION LIFECYCLE
// =============================================================================

export const SESSION_EVENTS = {
  /** User successfully logged in */
  LOGIN: "user_login",
  /** User logged out */
  LOGOUT: "user_logout",
  /** User deleted their account */
  ACCOUNT_DELETED: "account_deleted",
} as const;

// =============================================================================
// ONBOARDING & CONVERSION
// =============================================================================

export const ONBOARDING_EVENTS = {
  /** User completed the entire onboarding flow */
  COMPLETE: "onboarding_complete",
} as const;

// =============================================================================
// TRACKING PERMISSIONS (ATT)
// =============================================================================

export const TRACKING_EVENTS = {
  /** User granted App Tracking Transparency permission */
  PERMISSION_GRANTED: "tracking_permission_granted",
  /** User denied App Tracking Transparency permission */
  PERMISSION_DENIED: "tracking_permission_denied",
  /** User skipped App Tracking Transparency prompt */
  PERMISSION_SKIPPED: "tracking_permission_skipped",
} as const;

// =============================================================================
// SOCIAL INTERACTIONS
// =============================================================================

export const SOCIAL_EVENTS = {
  /** User checked in to a place */
  CHECKIN: "checkin",
  /** Two users matched */
  MATCH: "match",
} as const;

// =============================================================================
// CONSOLIDATED EXPORT
// =============================================================================

export const ANALYTICS_EVENTS = {
  SESSION: SESSION_EVENTS,
  ONBOARDING: ONBOARDING_EVENTS,
  TRACKING: TRACKING_EVENTS,
  SOCIAL: SOCIAL_EVENTS,
} as const;

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/** Extract all event names as a union type */
type EventCatalog = typeof ANALYTICS_EVENTS;
type ExtractEvents<T> = T extends Record<string, infer U>
  ? U extends string
    ? U
    : U extends Record<string, infer V>
      ? V
      : never
  : never;

export type AnalyticsEventName = ExtractEvents<EventCatalog>;

/**
 * Type-safe event parameters by event name.
 * Extend this interface to add required parameters for specific events.
 */
export interface AnalyticsEventParams {
  [TRACKING_EVENTS.PERMISSION_GRANTED]: { screen: string };
  [TRACKING_EVENTS.PERMISSION_DENIED]: { screen: string };
  [TRACKING_EVENTS.PERMISSION_SKIPPED]: { screen: string };
  [SESSION_EVENTS.LOGIN]: { method: string };
  [SESSION_EVENTS.ACCOUNT_DELETED]: { reason?: string };
  [SOCIAL_EVENTS.CHECKIN]: {
    placeId: string;
    placeName?: string;
    entryType: "physical" | "checkin_plus";
  };
  [SOCIAL_EVENTS.MATCH]: {
    matchedUserId: string;
    interactionId: string;
  };
}
