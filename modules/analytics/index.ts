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
    trackOnboardingComplete, trackOnboardingPermission, trackOnboardingStepComplete, type LoginMethod
} from "./analytics-service";

// Hooks (for screen tracking)
export { useScreenTracking } from "./hooks";

// Consent utilities (for settings screen opt-out)
export {
    getTrackingStatus, isTrackingAllowed, requestTrackingPermission, shouldRequestTracking, type TrackingStatus
} from "./tracking-consent";

