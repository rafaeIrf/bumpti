import { CircleCheckDashedIcon } from "@/assets/icons";
import { useIsProfileVerified } from "@/hooks/use-is-profile-verified";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { VerificationStatus } from "@/modules/store/slices/profileSlice";
import React from "react";
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from "react-native";

export interface VerificationBadgeProps {
  /**
   * Verification status for other users' profiles.
   * If not provided, uses the hook to get current user's status.
   */
  verification_status?: VerificationStatus | null;
  
  /**
   * Whether the badge should be clickable (only for own profile).
   * Default: false
   */
  clickable?: boolean;
  
  /**
   * Callback when badge is pressed (only works if clickable=true).
   */
  onPress?: () => void;
  
  /**
   * Size of the badge icon.
   * Default: 24
   */
  size?: number;
  
  /**
   * Additional style for the container.
   */
  style?: StyleProp<ViewStyle>;
}

/**
 * VerificationBadge Component
 * 
 * Displays a verification badge icon that changes color based on verification status.
 * 
 * - If `verification_status` prop is provided: uses it (for other users)
 * - If not provided: uses `useIsProfileVerified()` hook (for own profile)
 * 
 * @example
 * ```tsx
 * // For own profile (uses hook)
 * <VerificationBadge clickable onPress={handleVerify} />
 * 
 * // For other users (uses prop)
 * <VerificationBadge verification_status={profile.verification_status} />
 * ```
 */
export function VerificationBadge({
  verification_status: propVerificationStatus,
  clickable = false,
  onPress,
  size = 24,
  style,
}: VerificationBadgeProps) {
  const colors = useThemeColors();
  
  // Use hook for own profile if prop not provided
  const isOwnProfileVerified = useIsProfileVerified();
  
  // Determine verification status
  const isVerified = propVerificationStatus !== undefined
    ? propVerificationStatus === "verified"
    : isOwnProfileVerified;
  
  // Determine badge color
  const badgeColor = isVerified ? colors.accent : colors.textSecondary;
  
  // Render badge
  const badgeContent = (
    <CircleCheckDashedIcon
      width={size}
      height={size}
      color={badgeColor}
    />
  );
  
  // If clickable, wrap in Pressable
  if (clickable && onPress && !isVerified) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.badge,
          {
            opacity: pressed ? 0.6 : 1,
          },
          style,
        ]}
      >
        {badgeContent}
      </Pressable>
    );
  }
  
  // Non-clickable badge
  return (
    <View style={[styles.badge, style]}>
      {badgeContent}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    padding: 2,
  },
});
