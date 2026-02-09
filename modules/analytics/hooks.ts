import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { ANALYTICS_EVENTS } from "./analytics-events";
import { trackEvent } from "./analytics-service";

interface ScreenTrackingOptions {
  screenName: string;
  params?: Record<string, string | number | boolean>;
}

/**
 * Hook for automatic screen view tracking.
 *
 * Dispatches to both Firebase Analytics and PostHog when screen comes into focus.
 * This is the standard way to track screen navigation in the app.
 *
 * @param options - Screen tracking configuration
 * @param options.screenName - Name of the screen (e.g., 'onboarding_name', 'auth_welcome')
 * @param options.params - Optional parameters to attach to the event
 *
 * @example
 * ```tsx
 * // Basic usage
 * useScreenTracking({ screenName: 'onboarding_name' });
 *
 * // With parameters
 * useScreenTracking({
 *   screenName: 'category_results',
 *   params: { mode: 'trending', category: 'cafe' }
 * });
 * ```
 */
export function useScreenTracking({
  screenName,
  params,
}: ScreenTrackingOptions): void {
  useFocusEffect(
    useCallback(() => {
      trackEvent(ANALYTICS_EVENTS.SCREEN.SCREEN_VIEW, {
        screen_name: screenName,
        ...params,
      });
    }, [screenName, params]),
  );
}
