import { Button } from "@/components/ui/button";
import { spacing } from "@/constants/theme";
import useSafeAreaInsets from "@/hooks/use-safe-area-insets";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { StyleSheet, View, ViewStyle } from "react-native";

interface ScreenBottomBarProps {
  // Primary action button
  primaryLabel?: string;
  onPrimaryPress?: () => void;
  primaryDisabled?: boolean;

  // Secondary action button (optional)
  secondaryLabel?: string;
  onSecondaryPress?: () => void;
  secondaryDisabled?: boolean;

  // Layout options
  variant?: "single" | "dual" | "custom";

  // For custom content
  children?: React.ReactNode;

  // Styling
  style?: ViewStyle;
  showBorder?: boolean;
  backgroundColor?: string;
}

/**
 * Fixed bottom bar for screens with action buttons.
 *
 * Features:
 * - Automatic safe area bottom padding
 * - Single or dual button layouts
 * - Optional custom content
 * - Optional top border separator
 * - Theme-aware styling
 *
 * Usage:
 * ```tsx
 * // Single button (most common)
 * <ScreenBottomBar
 *   primaryLabel="Continue"
 *   onPrimaryPress={handleContinue}
 *   primaryDisabled={!isValid}
 * />
 *
 * // Dual buttons
 * <ScreenBottomBar
 *   variant="dual"
 *   secondaryLabel="Skip"
 *   onSecondaryPress={handleSkip}
 *   primaryLabel="Continue"
 *   onPrimaryPress={handleContinue}
 * />
 *
 * // Custom content
 * <ScreenBottomBar variant="custom">
 *   <YourCustomButtons />
 * </ScreenBottomBar>
 * ```
 */
export function ScreenBottomBar({
  primaryLabel,
  onPrimaryPress,
  primaryDisabled = false,
  secondaryLabel,
  onSecondaryPress,
  secondaryDisabled = false,
  variant = "single",
  children,
  style,
  showBorder = false,
  backgroundColor,
}: ScreenBottomBarProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  const containerStyle = [
    styles.container,
    {
      paddingBottom: Math.max(spacing.xl, insets.bottom + spacing.md),
      backgroundColor: backgroundColor || colors.background,
      borderTopColor: showBorder ? colors.border : "transparent",
    },
    style,
  ];

  // Custom content variant
  if (variant === "custom") {
    return <View style={containerStyle}>{children}</View>;
  }

  // Dual button variant
  if (variant === "dual") {
    return (
      <View style={containerStyle}>
        <View style={styles.dualButtonRow}>
          {secondaryLabel && onSecondaryPress && (
            <View style={styles.dualButton}>
              <Button
                onPress={onSecondaryPress}
                disabled={secondaryDisabled}
                variant="outline"
                size="lg"
                fullWidth
              >
                {secondaryLabel}
              </Button>
            </View>
          )}
          {primaryLabel && onPrimaryPress && (
            <View style={styles.dualButton}>
              <Button
                onPress={onPrimaryPress}
                disabled={primaryDisabled}
                size="lg"
                fullWidth
              >
                {primaryLabel}
              </Button>
            </View>
          )}
        </View>
      </View>
    );
  }

  // Single button variant (default)
  return (
    <View style={containerStyle}>
      {primaryLabel && onPrimaryPress && (
        <Button
          onPress={onPrimaryPress}
          disabled={primaryDisabled}
          size="lg"
          fullWidth
        >
          {primaryLabel}
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  dualButtonRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  dualButton: {
    flex: 1,
  },
});
