import { spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { logger } from "@/utils/logger";
import { useCallback, useEffect } from "react";
import {
  BackHandler,
  Image,
  Linking,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";

interface ForceUpdateScreenProps {
  storeUrl?: string | null;
}

/**
 * Full-screen blocking overlay for mandatory app updates.
 *
 * Features:
 * - Covers entire screen with Bumpti branding
 * - Pure black background matching splash screen
 * - Blocks Android back button
 * - Opens native store URL on button press
 */
export function ForceUpdateScreen({ storeUrl }: ForceUpdateScreenProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  // Block Android back button
  useEffect(() => {
    if (Platform.OS !== "android") return;

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        // Return true to prevent default behavior (exiting app)
        return true;
      },
    );

    return () => backHandler.remove();
  }, []);

  const handleUpdatePress = useCallback(async () => {
    try {
      // Try store URL from config first
      if (storeUrl) {
        const canOpen = await Linking.canOpenURL(storeUrl);
        if (canOpen) {
          await Linking.openURL(storeUrl);
          return;
        }
      }

      // Fallback to platform-specific store URLs
      const fallbackUrl =
        Platform.OS === "ios"
          ? "https://apps.apple.com/app/id6755127354"
          : "https://play.google.com/store/apps/details?id=com.bumpti";
      await Linking.openURL(fallbackUrl);
    } catch (error) {
      logger.error("[ForceUpdate] Failed to open store URL", { error });
    }
  }, [storeUrl]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xxl }]}>
      {/* Logo */}
      <View style={styles.logoContainer}>
        <Image
          source={require("@/assets/images/bumpti-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <ThemedText variant="heading" style={styles.title}>
          {t("versionCheck.forceUpdate.title")}
        </ThemedText>
        <ThemedText
          variant="body"
          style={[styles.message, { color: colors.textSecondary }]}
        >
          {t("versionCheck.forceUpdate.message")}
        </ThemedText>
      </View>

      {/* Update Button */}
      <View
        style={[
          styles.buttonContainer,
          { paddingBottom: insets.bottom + spacing.lg },
        ]}
      >
        <Button
          variant="default"
          size="lg"
          fullWidth
          onPress={handleUpdatePress}
          label={t("versionCheck.forceUpdate.button")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000", // Pure black to match splash screen
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  logoContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 120,
    height: 120,
  },
  content: {
    alignItems: "center",
    paddingHorizontal: spacing.md,
  },
  title: {
    textAlign: "center",
    marginBottom: spacing.md,
  },
  message: {
    textAlign: "center",
    lineHeight: 24,
  },
  buttonContainer: {
    width: "100%",
    paddingTop: spacing.xxl,
  },
});
