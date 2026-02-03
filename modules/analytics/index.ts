/**
 * Analytics Module
 *
 * Public API for the analytics system.
 * Exports the provider and all tracking functions.
 */

// Provider (for _layout.tsx)
export { AnalyticsProvider } from "./analytics-provider";

// Event constants (for type-safe event tracking)
export { ANALYTICS_EVENTS } from "./analytics-events";
export type { AnalyticsEventName, AnalyticsEventParams } from "./analytics-events";

// Tracking functions (for event injection)
export {
    identify,
    reset,
    trackAccountDeletion,
    trackCheckin,
    trackEvent,
    trackLogin,
    trackLogout,
    trackMatch,
    trackOnboardingComplete,
    type LoginMethod
} from "./analytics-service";

// Consent utilities (for settings screen opt-out)
export {
    getTrackingStatus, isTrackingAllowed, requestTrackingPermission, shouldRequestTracking, type TrackingStatus
} from "./tracking-consent";

