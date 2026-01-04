import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import React, { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  FadeInDown,
  FadeInUp,
  ZoomIn,
} from "react-native-reanimated";

interface PermissionPromptViewProps {
  renderIcon: () => ReactNode;
  title: string;
  subtitle: string;
  enableButtonText?: string;
  requestingText?: string;
  skipButtonText?: string;
  isRequesting: boolean;
  canAskAgain: boolean;
  onEnable: () => void;
  onSkip: () => void;
  onOpenSettings: () => void;
  hideSkip?: boolean;
}

export function PermissionPromptView({
  renderIcon,
  title,
  subtitle,
  enableButtonText,
  requestingText,
  skipButtonText,
  isRequesting,
  canAskAgain,
  onEnable,
  onSkip,
  onOpenSettings,
  hideSkip = false,
}: PermissionPromptViewProps) {
  const colors = useThemeColors();

  const handleAction = () => {
    if (canAskAgain) {
      onEnable();
    } else {
      onOpenSettings();
    }
  };

  const primaryButtonText = isRequesting
    ? requestingText || t("common.loading")
    : canAskAgain
    ? enableButtonText || t("common.enable")
    : t("actions.openSettings");

  return (
    <View style={styles.container}>
      {/* Icon Area */}
      <Animated.View
        entering={ZoomIn.delay(200).duration(600).springify()}
        style={styles.iconContainer}
      >
        {renderIcon()}
      </Animated.View>

      {/* Text Area */}
      <Animated.View
        entering={FadeInUp.delay(400).duration(500)}
        style={styles.textContainer}
      >
        <ThemedText style={[styles.title, { color: colors.text }]}>
          {title}
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
          {subtitle}
        </ThemedText>
      </Animated.View>

      {/* Buttons Area */}
      <Animated.View
        entering={FadeInDown.delay(600).duration(500)}
        style={styles.buttonsContainer}
      >
        <Button
          onPress={handleAction}
          disabled={isRequesting}
          size="lg"
          fullWidth
          style={[
            styles.primaryButton,
            !canAskAgain && { backgroundColor: colors.accent },
          ]}
        >
          <ThemedText style={styles.primaryButtonText}>
            {primaryButtonText}
          </ThemedText>
        </Button>

        {!hideSkip && (
          <Button
            onPress={onSkip}
            disabled={isRequesting}
            variant="ghost"
            size="lg"
            fullWidth
            style={styles.skipButton}
          >
            <ThemedText
              style={[styles.skipButtonText, { color: colors.textSecondary }]}
            >
              {skipButtonText || t("actions.skip")}
            </ThemedText>
          </Button>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  iconContainer: {
    marginBottom: spacing.xl,
    position: "relative",
  },
  textContainer: {
    alignItems: "center",
    marginBottom: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  title: {
    ...typography.heading,
    fontSize: 28,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
  buttonsContainer: {
    width: "100%",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  primaryButton: {
    minHeight: 56,
  },
  primaryButtonText: {
    ...typography.body,
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  skipButton: {
    minHeight: 56,
  },
  skipButtonText: {
    ...typography.body,
    fontWeight: "600",
    fontSize: 16,
  },
});
