import { useAppSelector } from "@/modules/store/hooks";

/**
 * Hook to check if the current user profile is verified.
 * 
 * This hook subscribes to Redux state changes, so the component
 * will re-render when verification_status changes.
 * 
 * @returns True if verification_status is 'verified', false otherwise
 * 
 * @example
 * ```tsx
 * import { useIsProfileVerified } from "@/hooks/use-is-profile-verified";
 * 
 * function ProfileScreen() {
 *   const isVerified = useIsProfileVerified();
 *   const badgeColor = isVerified ? colors.accent : colors.textSecondary;
 *   
 *   return <Icon color={badgeColor} />;
 * }
 * ```
 */
export function useIsProfileVerified(): boolean {
  return useAppSelector(
    (state) => state.profile.data?.verification_status === "verified"
  );
}
