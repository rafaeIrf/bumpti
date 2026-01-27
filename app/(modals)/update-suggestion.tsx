import { XIcon } from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { logger } from "@/utils/logger";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { Linking, Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Modal screen for suggesting optional app updates.
 *
 * Shows when a newer version is available but not required.
 * Users can update now or dismiss to continue using the app.
 */
export default function UpdateSuggestionModal() {
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  const handleUpdate = useCallback(async () => {
    try {
      // Use platform-specific store URLs
      const storeUrl =
        Platform.OS === "ios"
          ? "https://apps.apple.com/app/id6755127354"
          : "https://play.google.com/store/apps/details?id=com.bumpti";
      await Linking.openURL(storeUrl);
    } catch (error) {
      logger.error("[UpdateSuggestion] Failed to open store URL", { error });
    }
  }, []);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: Platform.select({
            ios: spacing.md,
            android: insets.top + spacing.md,
          }),
        },
      ]}
    >
      {/* Close Button */}
      <Animated.View
        entering={FadeInUp.duration(400)}
        style={styles.closeButton}
      >
        <Pressable
          onPress={handleClose}
          style={({ pressed }) => [
            styles.closeButtonInner,
            {
              backgroundColor: pressed ? colors.surfaceHover : colors.surface,
            },
          ]}
        >
          <XIcon width={20} height={20} color={colors.text} />
        </Pressable>
      </Animated.View>

      {/* Content */}
      <View style={styles.content}>
        {/* Illustration */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(100)}
          style={styles.illustrationContainer}
        >
          <Image
            source={require("@/assets/images/bumpti-logo.png")}
            style={styles.illustration}
            contentFit="contain"
          />
        </Animated.View>

        {/* Text Content */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(200)}
          style={styles.textContent}
        >
          <ThemedText style={[typography.heading, styles.title]}>
            {t("versionCheck.suggestUpdate.title")}
          </ThemedText>
          <ThemedText
            style={[
              typography.body,
              styles.message,
              { color: colors.textSecondary },
            ]}
          >
            {t("versionCheck.suggestUpdate.message")}
          </ThemedText>
        </Animated.View>
      </View>

      {/* Buttons */}
      <Animated.View
        entering={FadeInUp.duration(400).delay(400)}
        style={[
          styles.buttonContainer,
          { paddingBottom: insets.bottom + spacing.lg },
        ]}
      >
        <Button
          onPress={handleUpdate}
          label={t("versionCheck.suggestUpdate.updateButton")}
          fullWidth
          size="lg"
        />
        <Button
          variant="ghost"
          onPress={handleClose}
          label={t("versionCheck.suggestUpdate.laterButton")}
          fullWidth
          size="lg"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  closeButton: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    zIndex: 20,
  },
  closeButtonInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  illustrationContainer: {
    marginBottom: spacing.xl,
  },
  illustration: {
    width: 100,
    height: 100,
  },
  textContent: {
    alignItems: "center",
  },
  title: {
    textAlign: "center",
    marginBottom: spacing.md,
  },
  message: {
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: spacing.md,
  },
  buttonContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
});
