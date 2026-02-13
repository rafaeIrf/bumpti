import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { Ionicons } from "@expo/vector-icons";
import React, { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
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
  isRequesting: boolean;
  canAskAgain: boolean;
  onEnable: () => void;
  onOpenSettings?: () => void; // Optional for tracking permission
  onClose?: () => void; // Optional X close button in top-right corner
}

export function PermissionPromptView({
  renderIcon,
  title,
  subtitle,
  enableButtonText,
  requestingText,
  isRequesting,
  canAskAgain,
  onEnable,
  onOpenSettings,
  onClose,
}: PermissionPromptViewProps) {
  const colors = useThemeColors();

  const handleAction = () => {
    if (canAskAgain) {
      onEnable();
    } else if (onOpenSettings) {
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
      {/* Close button */}
      {onClose && (
        <Pressable onPress={onClose} style={styles.closeButton} hitSlop={12}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </Pressable>
      )}

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
  closeButton: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    zIndex: 1,
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
});
