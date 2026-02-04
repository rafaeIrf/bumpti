import { useEffect } from "react";
import { trackEvent } from "./analytics-service";

/**
 * Hook for automatic screen view tracking.
 *
 * Dispatches to both Firebase Analytics and PostHog when component mounts.
 * This is the standard way to track screen navigation in the app.
 *
 * @param screenName - Name of the screen (e.g., 'onboarding_name', 'auth_welcome')
 * @param params - Optional parameters to attach to the event
 *
 * @example
 * ```tsx
 * // Basic usage
 * useScreenTracking('onboarding_name');
 *
 * // With parameters
 * useScreenTracking('onboarding_name', {
 *   onboarding_step: 1,
 *   step_name: 'name',
 * });
 * ```
 */
export function useScreenTracking(
  screenName: string,
  params?: Record<string, string | number | boolean>
): void {
  useEffect(() => {
    trackEvent("screen_view", {
      screen_name: screenName,
      ...params,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount
}
