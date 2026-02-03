/**
 * Analytics Module
 *
 * Public API for the analytics system.
 * Exports the provider and all tracking functions.
 */

// Provider (for _layout.tsx)
export { AnalyticsProvider } from "./analytics-provider";

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
    getTrackingStatus, isTrackingAllowed, requestTrackingPermission, type TrackingStatus
} from "./tracking-consent";

