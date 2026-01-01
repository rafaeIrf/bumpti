import { NavigationIcon } from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import Button from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import React, { useCallback, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

interface LocationPermissionStateProps {
  /**
   * Whether the permission can still be requested via system dialog.
   * If false, button will open settings instead.
   */
  canAskAgain: boolean;
  /**
   * Function to request location permission.
   * Should be from the SAME useLocationPermission hook instance as the parent.
   */
  onRequest: () => Promise<{ status: string }>;
  /**
   * Function to open system settings.
   * Should be from the SAME useLocationPermission hook instance as the parent.
   */
  onOpenSettings: () => Promise<void>;
}

/**
 * Empty state component shown when location permission is required.
 * IMPORTANT: Permission functions must be passed from the parent component
 * to ensure state updates are reflected in the same hook instance.
 */
export function LocationPermissionState({
  canAskAgain,
  onRequest,
  onOpenSettings,
}: LocationPermissionStateProps) {
  const colors = useThemeColors();
  const [isRequesting, setIsRequesting] = useState(false);

  const handlePress = useCallback(async () => {
    setIsRequesting(true);
    try {
      if (canAskAgain) {
        await onRequest();
      } else {
        await onOpenSettings();
      }
    } finally {
      setIsRequesting(false);
    }
  }, [canAskAgain, onRequest, onOpenSettings]);

  const buttonLabel = canAskAgain
    ? t("permissions.location.button")
    : t("permissions.location.buttonSettings");

  return (
    <Animated.View entering={FadeInDown.delay(0).springify()}>
      <ThemedView style={styles.container}>
        <ThemedView
          style={[
            styles.iconContainer,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <NavigationIcon width={48} height={48} color={colors.textSecondary} />
        </ThemedView>
        <ThemedText
          style={[
            styles.title,
            { ...typography.subheading, color: colors.text },
          ]}
        >
          {t("permissions.location.title")}
        </ThemedText>
        <ThemedText
          style={[
            styles.description,
            { ...typography.body, color: colors.textSecondary },
          ]}
        >
          {t("permissions.location.subtitle")}
        </ThemedText>

        <Button
          onPress={handlePress}
          variant="default"
          size="lg"
          label={buttonLabel}
          loading={isRequesting}
          style={styles.button}
        />
      </ThemedView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
    minHeight: 400,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  title: {
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  description: {
    textAlign: "center",
    maxWidth: 320,
    marginBottom: spacing.lg,
  },
  button: {
    paddingHorizontal: spacing.xl,
  },
});
