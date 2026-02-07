import { CompassIcon } from "@/assets/icons";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

export default function DiscoverEmptyState() {
  const colors = useThemeColors();
  const router = useRouter();

  const handleExplore = () => {
    router.replace("/(tabs)/(home)");
  };

  return (
    <Animated.View entering={FadeIn.duration(500)} style={styles.container}>
      {/* Illustration icon */}
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: `${colors.accent}15` },
        ]}
      >
        <CompassIcon width={40} height={40} color={colors.accent} />
      </View>

      {/* Title */}
      <Text
        style={[
          typography.heading,
          { color: colors.text, textAlign: "center" },
        ]}
      >
        {t("screens.discover.emptyTitle")}
      </Text>

      {/* Subtitle */}
      <Text
        style={[
          typography.body,
          {
            color: colors.textSecondary,
            textAlign: "center",
            marginTop: spacing.sm,
            paddingHorizontal: spacing.xl,
          },
        ]}
      >
        {t("screens.discover.emptySubtitle")}
      </Text>

      {/* CTA Button */}
      <Pressable
        onPress={handleExplore}
        style={({ pressed }) => [
          styles.ctaButton,
          {
            backgroundColor: colors.accent,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Text
          style={[
            typography.body,
            {
              color: "#FFFFFF",
              fontWeight: "600",
              textAlign: "center",
            },
          ]}
        >
          {t("screens.discover.emptyCta")}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: 80,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  ctaButton: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 28,
    minWidth: 200,
  },
});
