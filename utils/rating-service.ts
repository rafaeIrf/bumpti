import { submitAppFeedback } from "@/modules/feedback/api";
import { logger } from "@/utils/logger";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import * as StoreReview from "expo-store-review";

// AsyncStorage Keys
const STORAGE_KEYS = {
  FIRST_OPEN_AT: "@bumpti:rating:first_open_at",
  SESSION_COUNT: "@bumpti:rating:session_count",
  MATCHES_COUNT: "@bumpti:rating:matches_count",
  LAST_REQUEST_AT: "@bumpti:rating:last_request_at",
  HAS_RATED_POSITIVELY: "@bumpti:rating:has_rated_positively",
} as const;

// Constants
const COOLDOWN_DAYS = 90;
const RETENTION_TRIGGER_SESSIONS = 10;
const DELAY_BEFORE_MODAL_MS = 1500; // 1.5 seconds delay

// Trigger types
export type RatingTriggerType = "first_match" | "retention";

interface RatingData {
  firstOpenAt: string | null;
  sessionCount: number;
  matchesCount: number;
  lastRequestAt: string | null;
  hasRatedPositively: boolean;
}

/**
 * Initialize rating tracking on first app launch
 * Sets the first_open_at timestamp if not already set
 */
export async function initializeRatingTracking(): Promise<void> {
  try {
    const firstOpenAt = await AsyncStorage.getItem(STORAGE_KEYS.FIRST_OPEN_AT);
    
    if (!firstOpenAt) {
      const now = new Date().toISOString();
      await AsyncStorage.setItem(STORAGE_KEYS.FIRST_OPEN_AT, now);
      await AsyncStorage.setItem(STORAGE_KEYS.SESSION_COUNT, "0");
      await AsyncStorage.setItem(STORAGE_KEYS.MATCHES_COUNT, "0");
      logger.log("Rating tracking initialized:", now);
    }
  } catch (error) {
    logger.error("Error initializing rating tracking:", error);
  }
}

/**
 * Increment session count
 * Call this when app comes to foreground
 */
export async function incrementSessionCount(): Promise<void> {
  try {
    const current = await AsyncStorage.getItem(STORAGE_KEYS.SESSION_COUNT);
    const count = current ? parseInt(current, 10) : 0;
    await AsyncStorage.setItem(STORAGE_KEYS.SESSION_COUNT, String(count + 1));
    logger.log("Session count incremented:", count + 1);
  } catch (error) {
    logger.error("Error incrementing session count:", error);
  }
}

/**
 * Increment match count
 * Call this when user gets a new match
 */
export async function incrementMatchCount(): Promise<void> {
  try {
    const current = await AsyncStorage.getItem(STORAGE_KEYS.MATCHES_COUNT);
    const count = current ? parseInt(current, 10) : 0;
    await AsyncStorage.setItem(STORAGE_KEYS.MATCHES_COUNT, String(count + 1));
    logger.log("Match count incremented:", count + 1);
  } catch (error) {
    logger.error("Error incrementing match count:", error);
  }
}



/**
 * Get current rating data from AsyncStorage
 */
async function getRatingData(): Promise<RatingData> {
  try {
    const [firstOpenAt, sessionCount, matchesCount, lastRequestAt, hasRatedPositively] =
      await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.FIRST_OPEN_AT),
        AsyncStorage.getItem(STORAGE_KEYS.SESSION_COUNT),
        AsyncStorage.getItem(STORAGE_KEYS.MATCHES_COUNT),
        AsyncStorage.getItem(STORAGE_KEYS.LAST_REQUEST_AT),
        AsyncStorage.getItem(STORAGE_KEYS.HAS_RATED_POSITIVELY),
      ]);

    return {
      firstOpenAt,
      sessionCount: sessionCount ? parseInt(sessionCount, 10) : 0,
      matchesCount: matchesCount ? parseInt(matchesCount, 10) : 0,
      lastRequestAt,
      hasRatedPositively: hasRatedPositively === "true",
    };
  } catch (error) {
    logger.error("Error getting rating data:", error);
    return {
      firstOpenAt: null,
      sessionCount: 0,
      matchesCount: 0,
      lastRequestAt: null,
      hasRatedPositively: false,
    };
  }
}

/**
 * Calculate days between two dates
 */
function daysSince(dateString: string): number {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

interface TriggerCheckResult {
  shouldShow: boolean;
  triggerType: RatingTriggerType | null;
}

/**
 * Check trigger conditions and determine which trigger (if any) is met
 * Single source of truth for all trigger logic
 */
async function checkTriggerConditions(): Promise<TriggerCheckResult> {
  try {
    const data = await getRatingData();

    if (data.hasRatedPositively) {
      logger.log("User already rated positively, skipping");
      return { shouldShow: false, triggerType: null };
    }

    if (data.lastRequestAt) {
      const daysSinceLastRequest = daysSince(data.lastRequestAt);
      if (daysSinceLastRequest < COOLDOWN_DAYS) {
        logger.log(
          `Cooldown active: ${daysSinceLastRequest} days since last request (${COOLDOWN_DAYS} required)`
        );
        return { shouldShow: false, triggerType: null };
      }
    }

    // Trigger A: First match (immediate success)
    if (data.matchesCount === 1) {
      logger.log("Trigger A met: First match");
      return { shouldShow: true, triggerType: "first_match" };
    }

    // Trigger B: Retention after N sessions
    if (data.sessionCount >= RETENTION_TRIGGER_SESSIONS) {
      logger.log(`Trigger B met: ${data.sessionCount} sessions`);
      return { shouldShow: true, triggerType: "retention" };
    }

    logger.log("No triggers met for rating modal");
    return { shouldShow: false, triggerType: null };
  } catch (error) {
    logger.error("Error checking trigger conditions:", error);
    return { shouldShow: false, triggerType: null };
  }
}

/**
 * Check if rating modal should be shown based on triggers
 * Returns true if any trigger condition is met and cooldown has passed
 */
export async function shouldShowRatingModal(): Promise<boolean> {
  const result = await checkTriggerConditions();
  return result.shouldShow;
}

/**
 * Check conditions and show rating modal if appropriate
 * This is the main entry point to be called after match creation
 */
export async function checkAndShowRatingModal(): Promise<void> {
  try {
    const { shouldShow, triggerType } = await checkTriggerConditions();

    if (!shouldShow || !triggerType) {
      return;
    }

    // Wait before showing to not interrupt the match celebration
    logger.log(`Waiting ${DELAY_BEFORE_MODAL_MS}ms before showing rating modal...`);

    // Use promise-based delay for better async control
    await new Promise((resolve) => setTimeout(resolve, DELAY_BEFORE_MODAL_MS));

    // Update last request timestamp (now properly awaited)
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_REQUEST_AT, new Date().toISOString());

    // Navigate to rating feedback modal with trigger context
    router.push({
      pathname: "/(modals)/rating-feedback",
      params: { trigger: triggerType },
    });
    logger.log("Rating feedback modal opened with trigger:", triggerType);
  } catch (error) {
    logger.error("Error in checkAndShowRatingModal:", error);
  }
}

/**
 * Record positive feedback and request native review
 * Call this when user selects positive option in internal modal
 * Note: userId is not needed as it's automatically extracted from JWT in the edge function
 */
export async function recordPositiveFeedback(message?: string): Promise<void> {
  try {
    // Mark as rated positively (never show again)
    await AsyncStorage.setItem(STORAGE_KEYS.HAS_RATED_POSITIVELY, "true");
    logger.log("User marked as having rated positively");

    // Save to database via API (fire-and-forget, don't block user)
    submitAppFeedback({
      rating_type: "positive",
      message: message || undefined,
    }).catch((error) => logger.error("Error submitting positive feedback:", error));

  } catch (error) {
    logger.error("Error recording positive feedback:", error);
  }
}

/**
 * Record negative feedback without requesting native review
 * Call this when user selects negative option in internal modal
 * Note: userId is not needed as it's automatically extracted from JWT in the edge function
 */
export async function recordNegativeFeedback(message?: string): Promise<void> {
  try {
    // Save to database via API (fire-and-forget, don't block user)
    submitAppFeedback({
      rating_type: "negative",
      message: message || undefined,
    }).catch((error) => logger.error("Error submitting negative feedback:", error));
  } catch (error) {
    logger.error("Error recording negative feedback:", error);
  }
}

/**
 * Request native App Store / Google Play review
 * Only call after positive feedback
 */
export async function requestNativeReview(): Promise<void> {
  try {
    const isAvailable = await StoreReview.isAvailableAsync();

    if (!isAvailable) {
      logger.warn("In-app review not available on this device");
      return;
    }

    logger.log("Requesting native store review");
    await StoreReview.requestReview();
    logger.log("Native review requested successfully");
  } catch (error) {
    logger.error("Error requesting native review:", error);
  }
}

/**
 * Reset all rating data
 * USE ONLY FOR TESTING - DO NOT USE IN PRODUCTION
 */
export async function resetRatingData(): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.FIRST_OPEN_AT),
      AsyncStorage.removeItem(STORAGE_KEYS.SESSION_COUNT),
      AsyncStorage.removeItem(STORAGE_KEYS.MATCHES_COUNT),
      AsyncStorage.removeItem(STORAGE_KEYS.LAST_REQUEST_AT),
      AsyncStorage.removeItem(STORAGE_KEYS.HAS_RATED_POSITIVELY),
    ]);
    logger.log("Rating data reset");
  } catch (error) {
    logger.error("Error resetting rating data:", error);
  }
}

/**
 * Get rating data for debugging
 * USE ONLY FOR DEV TOOLS
 */
export async function getRatingDataForDebug(): Promise<RatingData> {
  return getRatingData();
}
