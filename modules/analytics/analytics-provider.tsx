/**
 * Analytics Provider
 *
 * React context provider that initializes PostHog and handles ATT.
 * Should wrap the app at the root level in _layout.tsx.
 */

import Constants from "expo-constants";
import { PostHogProvider, usePostHog } from "posthog-react-native";
import { useEffect, useRef, type ReactNode } from "react";

import { logger } from "@/utils/logger";
import { setPostHogClient } from "./analytics-service";
import { isTrackingAllowed } from "./tracking-consent";

// Get PostHog credentials from environment
const POSTHOG_API_KEY =
  Constants.expoConfig?.extra?.POSTHOG_API_KEY ??
  process.env.EXPO_PUBLIC_POSTHOG_API_KEY ??
  "";
const POSTHOG_HOST =
  Constants.expoConfig?.extra?.POSTHOG_HOST ??
  process.env.EXPO_PUBLIC_POSTHOG_HOST ??
  "https://us.i.posthog.com";

type Props = {
  children: ReactNode;
};

/**
 * Inner component that has access to PostHog context.
 * Handles ATT request and client initialization.
 */
function AnalyticsInitializer({ children }: Props) {
  const posthog = usePostHog();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const initialize = async () => {
      try {
        // Check if tracking is allowed (permission will be requested in intro carousel)
        const canTrack = await isTrackingAllowed();

        if (!canTrack) {
          // User denied tracking - disable PostHog capture
          posthog.optOut();
          logger.info("Analytics: User denied tracking, PostHog disabled");
        } else {
          posthog.optIn();
          logger.info("Analytics: Tracking enabled");
        }

        // Register PostHog client with analytics service
        setPostHogClient(posthog);
        logger.debug("Analytics: PostHog client registered");
      } catch (error) {
        logger.error("Analytics initialization error", { error });
      }
    };

    initialize();
  }, [posthog]);

  return <>{children}</>;
}

/**
 * Analytics Provider Component
 *
 * Initializes PostHog with Session Replay and handles ATT permissions.
 * If PostHog credentials are missing, renders children without analytics.
 */
export function AnalyticsProvider({ children }: Props) {
  // Skip PostHog if API key is not configured
  if (!POSTHOG_API_KEY) {
    logger.warn(
      "Analytics: POSTHOG_API_KEY not configured, analytics disabled",
    );
    return <>{children}</>;
  }

  return (
    <PostHogProvider
      apiKey={POSTHOG_API_KEY}
      options={{
        host: POSTHOG_HOST,
        // Only create person profiles for identified users (after login)
        personProfiles: "identified_only",
        enableSessionReplay: true,
        sessionReplayConfig: {
          // Mask all text inputs for privacy
          maskAllTextInputs: true,
          // Mask all images for privacy
          maskAllImages: false,
          // Capture network requests
          captureNetworkTelemetry: true,
          // Android specific
          androidDebouncerDelayMs: 500,
          // iOS specific
          iOSdebouncerDelayMs: 500,
        },
        // Capture app lifecycle events
        captureAppLifecycleEvents: true,
        // Send events in batches
        flushAt: 20,
        flushInterval: 30000,
      }}
    >
      <AnalyticsInitializer>{children}</AnalyticsInitializer>
    </PostHogProvider>
  );
}
