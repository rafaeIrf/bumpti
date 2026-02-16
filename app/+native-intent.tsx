/**
 * +native-intent.tsx — Intercepts deep link URLs BEFORE Expo Router processes them.
 *
 * Without this file, Expo Router tries to match incoming Universal Link / App Link
 * URLs (e.g. https://bumpti.com/invite/plan/abc123) against file-based routes.
 * Since no app/invite/plan/[token].tsx exists, Expo Router resets the navigation
 * state, causing the app to reload and show the splash screen.
 *
 * This file redirects invite URLs to "/" so the app starts normally at the index
 * route. The actual deep link handling is done by useLinkingDeeplinks via
 * Linking.getInitialURL() which still returns the original URL.
 *
 * @see https://docs.expo.dev/router/reference/redirects/#native-intent
 */
export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}) {
  // Invite plan deep links are handled by useLinkingDeeplinks hook,
  // not by Expo Router's file-based routing.
  if (path.includes("/invite/plan/")) {
    return "/";
  }

  // All other paths: let Expo Router handle normally
  return path;
}
