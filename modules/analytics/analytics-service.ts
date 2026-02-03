/**
 * Analytics Service
 *
 * Centralized analytics service that dispatches events to both:
 * - PostHog: Product analytics + Session Replay
 * - Firebase Analytics: Google Ads UAC conversion pipeline
 *
 * Firebase uses GA4 standard e-commerce events (sign_up, add_to_cart, purchase)
 * because Google Ads UAC optimizes specifically for these events.
 */

import analytics from "@react-native-firebase/analytics";
import type { PostHog } from "posthog-react-native";

import { logger } from "@/utils/logger";
import { isTrackingAllowed } from "./tracking-consent";

// PostHog instance is set by the provider
let posthog: PostHog | null = null;

/**
 * Initialize PostHog client. Called from AnalyticsProvider.
 */
export function setPostHogClient(client: PostHog) {
  posthog = client;
}

/**
 * Identify user across both analytics providers.
 * Should be called after successful authentication.
 *
 * @param userId - Supabase user UUID
 * @param traits - Optional user traits (email, name, etc.)
 */
export async function identify(
  userId: string,
  traits?: Record<string, string | number | boolean>
): Promise<void> {
  try {
    const canTrack = await isTrackingAllowed();
    if (!canTrack) {
      logger.debug("Analytics: identify skipped (tracking denied)");
      return;
    }

    // PostHog identify
    if (posthog) {
      posthog.identify(userId, traits);
      logger.debug("Analytics: PostHog identify", { userId });
    }

    // Firebase setUserId
    await analytics().setUserId(userId);
    if (traits) {
      // Set user properties for Firebase
      const firebaseTraits: Record<string, string> = {};
      for (const [key, value] of Object.entries(traits)) {
        if (value !== null && value !== undefined) {
          firebaseTraits[key] = String(value);
        }
      }
      await analytics().setUserProperties(firebaseTraits);
    }
    logger.debug("Analytics: Firebase setUserId", { userId });
  } catch (error) {
    logger.error("Analytics: identify error", { error });
  }
}

/**
 * Reset analytics state on logout.
 * Clears user identity from both providers.
 */
export async function reset(): Promise<void> {
  try {
    // PostHog reset
    if (posthog) {
      posthog.reset();
      logger.debug("Analytics: PostHog reset");
    }

    // Firebase reset
    await analytics().resetAnalyticsData();
    logger.debug("Analytics: Firebase reset");
  } catch (error) {
    logger.error("Analytics: reset error", { error });
  }
}

// =============================================================================
// SESSION LIFECYCLE EVENTS
// =============================================================================

export type LoginMethod = "apple" | "google" | "email_otp";

/**
 * Track successful login.
 * Should be called after authentication completes successfully.
 *
 * @param provider - Raw provider string from session.user.app_metadata.provider
 */
export async function trackLogin(
  provider: string | undefined
): Promise<void> {
  try {
    const canTrack = await isTrackingAllowed();
    if (!canTrack) {
      logger.debug("Analytics: trackLogin skipped (tracking denied)");
      return;
    }

    // Normalize provider to LoginMethod
    const method: LoginMethod =
      provider === "apple"
        ? "apple"
        : provider === "google"
          ? "google"
          : "email_otp";

    // PostHog
    if (posthog) {
      posthog.capture("user_login", { method });
      logger.debug("Analytics: PostHog user_login", { method });
    }

    // Firebase
    await analytics().logLogin({ method });
    logger.debug("Analytics: Firebase login", { method });
  } catch (error) {
    logger.error("Analytics: trackLogin error", { error });
  }
}

/**
 * Track user logout.
 * Should be called BEFORE clearing Redux/WatermelonDB state.
 * This ensures the event is captured before session data is lost.
 */
export async function trackLogout(): Promise<void> {
  try {
    const canTrack = await isTrackingAllowed();
    if (!canTrack) {
      logger.debug("Analytics: trackLogout skipped (tracking denied)");
      return;
    }

    // PostHog - Capture event BEFORE reset
    if (posthog) {
      posthog.capture("user_logout");
      logger.debug("Analytics: PostHog user_logout");
    }

    // Firebase
    await analytics().logEvent("user_logout", {});
    logger.debug("Analytics: Firebase user_logout");

    // Now reset the session (clears cookies/identity)
    await reset();
  } catch (error) {
    logger.error("Analytics: trackLogout error", { error });
  }
}

/**
 * Track account deletion.
 * CRITICAL: This is the most important exit event.
 *
 * @param reason - Optional reason for deletion
 */
export async function trackAccountDeletion(
  reason?: string
): Promise<void> {
  try {
    const canTrack = await isTrackingAllowed();
    if (!canTrack) {
      logger.debug("Analytics: trackAccountDeletion skipped (tracking denied)");
      return;
    }

    // PostHog - Capture BEFORE session is destroyed
    if (posthog) {
      posthog.capture("account_deleted", {
        reason: reason ?? "not_specified",
      });
      logger.debug("Analytics: PostHog account_deleted", { reason });
    }

    // Firebase
    await analytics().logEvent("account_deleted", {
      reason: reason ?? "not_specified",
    });
    logger.debug("Analytics: Firebase account_deleted", { reason });
  } catch (error) {
    logger.error("Analytics: trackAccountDeletion error", { error });
  }
}

// =============================================================================
// CONVERSION EVENTS
// =============================================================================

/**
 * Track onboarding completion.
 * Fired when user successfully completes the signup flow.
 *
 * Firebase: sign_up (standard GA4 event for Google Ads)
 * PostHog: onboarding_complete
 */
export async function trackOnboardingComplete(): Promise<void> {
  try {
    const canTrack = await isTrackingAllowed();
    if (!canTrack) {
      logger.debug("Analytics: trackOnboardingComplete skipped (tracking denied)");
      return;
    }

    // PostHog
    if (posthog) {
      posthog.capture("onboarding_complete");
      logger.debug("Analytics: PostHog onboarding_complete");
    }

    // Firebase - use standard sign_up event for Google Ads
    await analytics().logSignUp({ method: "email" });
    logger.debug("Analytics: Firebase sign_up");
  } catch (error) {
    logger.error("Analytics: trackOnboardingComplete error", { error });
  }
}

type CheckinParams = {
  placeId: string;
  placeName?: string;
  entryType: "physical" | "checkin_plus";
};

/**
 * Track successful check-in at a place.
 * Fired when GPS validates user at location.
 *
 * Firebase: user_checkin (custom mid-funnel conversion event)
 * PostHog: checkin
 */
export async function trackCheckin(params: CheckinParams): Promise<void> {
  try {
    const canTrack = await isTrackingAllowed();
    if (!canTrack) {
      logger.debug("Analytics: trackCheckin skipped (tracking denied)");
      return;
    }

    const { placeId, placeName, entryType } = params;

    // PostHog
    if (posthog) {
      posthog.capture("checkin", {
        place_id: placeId,
        place_name: placeName ?? "",
        entry_type: entryType,
      });
      logger.debug("Analytics: PostHog checkin", { placeId, entryType });
    }

    // Firebase - use custom event for checkin (not add_to_cart - that's for e-commerce)
    await analytics().logEvent("user_checkin", {
      place_id: placeId,
      place_name: placeName ?? "",
      entry_type: entryType,
    });
    logger.debug("Analytics: Firebase user_checkin", { placeId, entryType });
  } catch (error) {
    logger.error("Analytics: trackCheckin error", { error });
  }
}

type MatchParams = {
  matchId?: string | null;
  placeId?: string;
};

/**
 * Track "It's a Match" event.
 * Fired when mutual like creates a match.
 *
 * Firebase: user_match (custom high-value conversion event)
 * PostHog: match
 */
export async function trackMatch(params: MatchParams): Promise<void> {
  try {
    const canTrack = await isTrackingAllowed();
    if (!canTrack) {
      logger.debug("Analytics: trackMatch skipped (tracking denied)");
      return;
    }

    const { matchId, placeId } = params;

    // PostHog
    if (posthog) {
      posthog.capture("match", {
        match_id: matchId ?? "",
        place_id: placeId ?? "",
      });
      logger.debug("Analytics: PostHog match", { matchId });
    }

    // Firebase - use custom event for match (not purchase - that's for e-commerce)
    await analytics().logEvent("user_match", {
      match_id: matchId ?? "",
      place_id: placeId ?? "",
      value: 1, // High value event for Google Ads UAC optimization
    });
    logger.debug("Analytics: Firebase user_match", { matchId });
  } catch (error) {
    logger.error("Analytics: trackMatch error", { error });
  }
}

// =============================================================================
// GENERIC EVENT TRACKING
// =============================================================================

/**
 * Track a generic event to both providers.
 * Use this for custom events not covered by specific functions.
 */
export async function trackEvent(
  eventName: string,
  properties?: Record<string, string | number | boolean>
): Promise<void> {
  try {
    const canTrack = await isTrackingAllowed();
    if (!canTrack) {
      logger.debug(`Analytics: trackEvent ${eventName} skipped (tracking denied)`);
      return;
    }

    // PostHog
    if (posthog) {
      posthog.capture(eventName, properties);
    }

    // Firebase - sanitize event name and properties
    const firebaseEventName = eventName.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 40);
    const firebaseParams: Record<string, string | number> = {};
    if (properties) {
      for (const [key, value] of Object.entries(properties)) {
        const sanitizedKey = key.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 40);
        if (typeof value === "string" || typeof value === "number") {
          firebaseParams[sanitizedKey] = value;
        } else if (typeof value === "boolean") {
          firebaseParams[sanitizedKey] = value ? 1 : 0;
        }
      }
    }
    await analytics().logEvent(firebaseEventName, firebaseParams);

    logger.debug(`Analytics: trackEvent ${eventName}`, { properties });
  } catch (error) {
    logger.error("Analytics: trackEvent error", { error, eventName });
  }
}
