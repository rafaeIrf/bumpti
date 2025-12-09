import { ArrowLeftIcon } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { spacing } from "@/constants/theme";
import useSafeAreaInsets from "@/hooks/use-safe-area-insets";
import { useThemeColors } from "@/hooks/use-theme-colors";
import React, { useEffect, useState } from "react";
import { Keyboard, Platform, StyleSheet, View, ViewStyle } from "react-native";

interface ScreenBottomBarProps {
  // Primary action button
  primaryLabel?: string;
  onPrimaryPress?: () => void;
  primaryDisabled?: boolean;
  primaryIcon?: React.ReactNode;

  // Secondary action button (optional)
  secondaryLabel?: string;
  onSecondaryPress?: () => void;
  secondaryDisabled?: boolean;

  // Wizard specific
  onBackPress?: () => void;

  // Layout options
  variant?: "single" | "dual" | "custom" | "wizard";

  // For custom content
  children?: React.ReactNode;

  // Content to display above buttons
  topContent?: React.ReactNode;

  // Styling
  style?: ViewStyle;
  showBorder?: boolean;
  backgroundColor?: string;
  compact?: boolean;
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
  primaryIcon,
  secondaryLabel,
  onSecondaryPress,
  secondaryDisabled = false,
  onBackPress,
  variant = "single",
  children,
  topContent,
  style,
  showBorder = false,
  backgroundColor,
  compact = false,
}: ScreenBottomBarProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const keyboardShowListener = Keyboard.addListener(showEvent, () =>
      setKeyboardVisible(true)
    );
    const keyboardHideListener = Keyboard.addListener(hideEvent, () =>
      setKeyboardVisible(false)
    );

    return () => {
      keyboardShowListener.remove();
      keyboardHideListener.remove();
    };
  }, []);

  let paddingBottom: number;
  if (compact) {
    paddingBottom = spacing.md;
  } else if (isKeyboardVisible) {
    paddingBottom = spacing.md;
  } else {
    paddingBottom = Math.max(spacing.xl, insets.bottom + spacing.md);
  }

  const containerStyle = [
    styles.container,
    {
      paddingBottom,
      backgroundColor: backgroundColor || colors.background,
      borderTopColor: showBorder ? colors.border : "transparent",
    },
    style,
  ];

  // Custom content variant
  if (variant === "custom") {
    return (
      <View style={containerStyle}>
        {topContent}
        {children}
      </View>
    );
  }

  // Dual button variant
  if (variant === "dual") {
    return (
      <View style={containerStyle}>
        {topContent && <View style={styles.topContent}>{topContent}</View>}
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

  // Wizard variant
  if (variant === "wizard") {
    return (
      <View style={containerStyle}>
        {topContent && <View style={styles.topContent}>{topContent}</View>}
        <View style={styles.wizardRow}>
          {/* Left: Back Button */}
          <View style={styles.wizardLeft}>
            {onBackPress && (
              <Button onPress={onBackPress} variant="secondary" size="fab">
                <ArrowLeftIcon width={24} height={24} color="#FFF" />
              </Button>
            )}
          </View>

          {/* Center: Skip Link */}
          <View style={styles.wizardCenter}>
            {secondaryLabel && onSecondaryPress && (
              <Button
                variant="ghost"
                label={secondaryLabel}
                onPress={onSecondaryPress}
                disabled={secondaryDisabled}
                textStyle={{ color: colors.textSecondary }}
              />
            )}
          </View>

          {/* Right: Primary Action (FAB-like) */}
          <View style={styles.wizardRight}>
            {onPrimaryPress && (
              <Button
                onPress={onPrimaryPress}
                disabled={primaryDisabled}
                variant="secondary"
                size="fab"
              >
                {primaryIcon}
              </Button>
            )}
          </View>
        </View>
      </View>
    );
  }

  // Single button variant (default)
  return (
    <View style={containerStyle}>
      {topContent && <View style={styles.topContent}>{topContent}</View>}
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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  topContent: {
    marginBottom: spacing.sm,
  },
  dualButtonRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  dualButton: {
    flex: 1,
  },
  wizardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  wizardLeft: {
    flex: 1,
    alignItems: "flex-start",
  },
  wizardCenter: {
    flex: 2,
    alignItems: "center",
  },
  wizardRight: {
    flex: 1,
    alignItems: "flex-end",
  },
  iconButton: {
    padding: spacing.xs,
  },
});
