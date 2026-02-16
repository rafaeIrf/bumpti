import { logger } from "@/utils/logger";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// useLinkingDeeplinks — handles URL-based deep links (Universal Links / App Links)
// ─────────────────────────────────────────────────────────────────────────────

const DEEPLINK_DOMAIN = process.env.EXPO_PUBLIC_DEEPLINK_DOMAIN || "bumpti.com";
const escapedDomain = DEEPLINK_DOMAIN.replace(/\./g, "\\.");
const PLAN_INVITE_REGEX = new RegExp(
  `(?:${escapedDomain}|bumpti:\\/\\/)\\/invite\\/plan\\/([a-f0-9]+)`,
  "i",
);

/**
 * Handles URL-based deep linking for:
 * - Universal Links (iOS): https://{domain}/invite/plan/{token}
 * - App Links (Android): https://{domain}/invite/plan/{token}
 * - Custom scheme: bumpti://invite/plan/{token}
 *
 * Mount this hook alongside useNotificationDeepLink in the DeepLinkHandler
 * component inside _layout.tsx.
 */
export function useLinkingDeeplinks() {
  const router = useRouter();
  const hasProcessedInitial = useRef(false);

  const handleUrl = useCallback(
    (url: string | null) => {
      if (!url) return;

      logger.log("[URLDeepLink] Received URL:", url);

      // Match plan invite URLs
      const planMatch = url.match(PLAN_INVITE_REGEX);
      if (planMatch) {
        const token = planMatch[1];
        logger.log("[URLDeepLink] Plan invite token:", token);

        // Ensure home/tabs is the base screen, then open modal on top
        router.push({
          pathname: "/(modals)/join-plan",
          params: { token },
        });
        return;
      }

      logger.log("[URLDeepLink] No matching route for URL:", url);
    },
    [router],
  );

  // ── Cold Start: check initial URL ──────────────────────────────────────
  useEffect(() => {
    if (hasProcessedInitial.current) return;

    const checkInitialUrl = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          hasProcessedInitial.current = true;
          logger.log("[URLDeepLink] Cold start URL:", initialUrl);

          // Delay to let navigation settle
          setTimeout(() => {
            handleUrl(initialUrl);
          }, 1500);
        }
      } catch (err) {
        logger.error("[URLDeepLink] Error checking initial URL:", err);
      }
    };

    checkInitialUrl();
  }, [handleUrl]);

  // ── Warm Start: listen for URL events ──────────────────────────────────
  useEffect(() => {
    const subscription = Linking.addEventListener("url", (event) => {
      logger.log("[URLDeepLink] Warm start URL:", event.url);
      handleUrl(event.url);
    });

    return () => subscription.remove();
  }, [handleUrl]);
}
