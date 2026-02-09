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
// SCREEN TRACKING
// =============================================================================

export const SCREEN_EVENTS = {
  /** User viewed a screen */
  SCREEN_VIEW: "screen_view",
} as const;

// =============================================================================
// HOME SCREEN INTERACTIONS
// =============================================================================

export const HOME_INTERACTION_EVENTS = {
  /** User clicked on a category card */
  CATEGORY_CLICKED: "home_category_clicked",
  /** User clicked on a trending place */
  TRENDING_PLACE_CLICKED: "home_trending_clicked",
  /** User opened search */
  SEARCH_OPENED: "home_search_opened",
  /** User opened filters */
  FILTER_OPENED: "home_filter_opened",
  /** Detection banner was shown to user */
  DETECTION_BANNER_SHOWN: "home_detection_shown",
  /** User clicked connect on detection banner */
  DETECTION_BANNER_CONNECT: "home_detection_connect",
  /** User dismissed detection banner */
  DETECTION_BANNER_DISMISS: "home_detection_dismiss",
} as const;

// =============================================================================
// CATEGORY RESULTS INTERACTIONS
// =============================================================================

export const CATEGORY_RESULTS_EVENTS = {
  /** Category results screen loaded */
  SCREEN_LOADED: "category_results_loaded",
  /** Place card became visible (impression) */
  PLACE_CARD_IMPRESSION: "place_card_impression",
  /** User clicked on a place card */
  PLACE_CARD_CLICKED: "place_card_clicked",
  /** User changed filter */
  FILTER_CHANGED: "category_filter_changed",
  /** User changed sort order */
  SORT_CHANGED: "category_sort_changed",
  /** Next page of results loaded */
  PAGINATION_LOADED: "category_page_loaded",
  /** User scrolled to a certain depth */
  SCROLL_DEPTH: "category_scroll_depth",
} as const;

// =============================================================================
// PLACE DETAILS INTERACTIONS
// =============================================================================

export const PLACE_DETAILS_EVENTS = {
  /** Place details bottom sheet opened */
  OPENED: "place_details_opened",
  /** User clicked connect button */
  CONNECT_CLICKED: "place_details_connect_clicked",
  /** User clicked navigate button */
  NAVIGATE_CLICKED: "place_details_navigate_clicked",
  /** User clicked rate button */
  RATE_CLICKED: "place_details_rate_clicked",
  /** User toggled favorite */
  FAVORITE_CLICKED: "place_details_favorite_clicked",
  /** User clicked report button */
  REPORT_CLICKED: "place_details_report_clicked",
  /** User dismissed bottom sheet */
  DISMISSED: "place_details_dismissed",
} as const;

// =============================================================================
// CHECK-IN FLOW
// =============================================================================

export const CHECKIN_FLOW_EVENTS = {
  /** User attempted to check in */
  CHECKIN_ATTEMPTED: "checkin_attempted",
  /** Check-in succeeded */
  CHECKIN_SUCCESS: "checkin_success",
  /** Check-in failed */
  CHECKIN_FAILED: "checkin_failed",
  /** Check-in+ sheet was shown */
  CHECKIN_PLUS_SHOWN: "checkin_plus_sheet_shown",
  /** User used check-in+ credit */
  CHECKIN_PLUS_USED: "checkin_plus_used",
  /** Credits purchase sheet shown */
  CREDITS_PURCHASE_SHOWN: "credits_purchase_shown",
  /** User purchased credits */
  CREDITS_PURCHASED: "credits_purchased",
  /** User navigated to place-people screen */
  PLACE_PEOPLE_NAVIGATED: "place_people_navigated",
} as const;

// =============================================================================
// CONSOLIDATED EXPORT
// =============================================================================

export const ANALYTICS_EVENTS = {
  SESSION: SESSION_EVENTS,
  ONBOARDING: ONBOARDING_EVENTS,
  TRACKING: TRACKING_EVENTS,
  SOCIAL: SOCIAL_EVENTS,
  SCREEN: SCREEN_EVENTS,
  HOME: HOME_INTERACTION_EVENTS,
  CATEGORY_RESULTS: CATEGORY_RESULTS_EVENTS,
  PLACE_DETAILS: PLACE_DETAILS_EVENTS,
  CHECKIN_FLOW: CHECKIN_FLOW_EVENTS,
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

  // Home interactions
  [HOME_INTERACTION_EVENTS.CATEGORY_CLICKED]: {
    categoryId: string;
    categoryName: string;
  };
  [HOME_INTERACTION_EVENTS.TRENDING_PLACE_CLICKED]: { placeId: string };
  [HOME_INTERACTION_EVENTS.DETECTION_BANNER_SHOWN]: {
    placeId: string;
    distance: number;
  };
  [HOME_INTERACTION_EVENTS.DETECTION_BANNER_CONNECT]: { placeId: string };
  [HOME_INTERACTION_EVENTS.DETECTION_BANNER_DISMISS]: { placeId: string };

  // Category results
  [CATEGORY_RESULTS_EVENTS.SCREEN_LOADED]: {
    mode: string;
    categoryName?: string;
    placeCount: number;
  };
  [CATEGORY_RESULTS_EVENTS.PLACE_CARD_IMPRESSION]: {
    placeId: string;
    position: number;
    context: string;
  };
  [CATEGORY_RESULTS_EVENTS.PLACE_CARD_CLICKED]: {
    placeId: string;
    position: number;
    context: string;
  };
  [CATEGORY_RESULTS_EVENTS.FILTER_CHANGED]: {
    filterType: string;
    filterValue: string;
  };
  [CATEGORY_RESULTS_EVENTS.SORT_CHANGED]: { sortBy: string };
  [CATEGORY_RESULTS_EVENTS.PAGINATION_LOADED]: {
    page: number;
    totalPlaces: number;
  };
  [CATEGORY_RESULTS_EVENTS.SCROLL_DEPTH]: { depthPercentage: number };

  // Place details
  [PLACE_DETAILS_EVENTS.OPENED]: {
    placeId: string;
    source: string;
    hasActiveUsers: boolean;
    distance?: number;
  };
  [PLACE_DETAILS_EVENTS.CONNECT_CLICKED]: {
    placeId: string;
    distance?: number;
    activeUsers: number;
  };
  [PLACE_DETAILS_EVENTS.NAVIGATE_CLICKED]: { placeId: string };
  [PLACE_DETAILS_EVENTS.RATE_CLICKED]: { placeId: string };
  [PLACE_DETAILS_EVENTS.FAVORITE_CLICKED]: {
    placeId: string;
    action: "add" | "remove";
  };
  [PLACE_DETAILS_EVENTS.REPORT_CLICKED]: { placeId: string };
  [PLACE_DETAILS_EVENTS.DISMISSED]: {
    placeId: string;
    timeSpent: number;
    hadInteraction: boolean;
  };

  // Check-in flow
  [CHECKIN_FLOW_EVENTS.CHECKIN_ATTEMPTED]: {
    placeId: string;
    distance: number;
    hasActivePresence: boolean;
  };
  [CHECKIN_FLOW_EVENTS.CHECKIN_SUCCESS]: {
    placeId: string;
    method: "physical" | "checkin_plus";
  };
  [CHECKIN_FLOW_EVENTS.CHECKIN_FAILED]: {
    placeId: string;
    reason: string;
  };
  [CHECKIN_FLOW_EVENTS.CHECKIN_PLUS_SHOWN]: {
    placeId: string;
    creditsAvailable: number;
  };
  [CHECKIN_FLOW_EVENTS.CHECKIN_PLUS_USED]: { placeId: string };
  [CHECKIN_FLOW_EVENTS.CREDITS_PURCHASE_SHOWN]: { placeId: string };
  [CHECKIN_FLOW_EVENTS.CREDITS_PURCHASED]: {
    quantity: number;
    placeId?: string;
  };
  [CHECKIN_FLOW_EVENTS.PLACE_PEOPLE_NAVIGATED]: {
    placeId: string;
    activeUsers: number;
  };
}
