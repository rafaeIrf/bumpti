import { store } from "@/modules/store";

/**
 * Helper function to get the current user ID from Redux store.
 * 
 * This is useful when you need just the user ID without fetching
 * the entire profile object or using the useProfile hook.
 * 
 * NOTE: This is a helper, not a hook. It won't trigger re-renders.
 * Use it in contexts where you just need the ID once (like in services).
 * 
 * @returns The user ID or undefined if not logged in
 * 
 * @example
 * ```typescript
 * import { getUserId } from "@/modules/profile";
 * 
 * const userId = getUserId();
 * if (userId) {
 *   // Do something with userId
 * }
 * ```
 */
export function getUserId(): string | undefined {
  const state = store.getState();
  return state.profile.data?.id;
}
