import { CrownIcon } from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

interface PremiumStatusCardProps {
  isPremium: boolean;
  onPress: () => void;
}

export function PremiumStatusCard({
  isPremium,
  onPress,
}: PremiumStatusCardProps) {
  const colors = useThemeColors();

  return (
    <Pressable onPress={onPress}>
      <LinearGradient
        colors={
          isPremium
            ? [
                (colors as any).cardGradientStart ?? colors.surface,
                (colors as any).cardGradientEnd ?? colors.surface,
              ]
            : [
                (colors as any).premiumBlue ?? colors.accent,
                (colors as any).premiumBlueDark ?? colors.surface,
              ]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.premiumCard,
          {
            shadowColor: isPremium
              ? "transparent"
              : (colors as any).premiumBlue ?? colors.accent,
          },
        ]}
      >
        <View style={styles.premiumHeader}>
          <View
            style={[
              styles.premiumIconContainer,
              {
                backgroundColor: isPremium
                  ? (colors as any).accent + "20"
                  : "rgba(255, 255, 255, 0.15)",
              },
            ]}
          >
            <CrownIcon
              width={24}
              height={24}
              color={isPremium ? colors.accent : colors.text}
            />
          </View>
          <View style={styles.premiumTextContainer}>
            <ThemedText
              style={[typography.body1, { color: colors.text }]} // Always text color now
            >
              {isPremium
                ? t("screens.profile.premium.active.title")
                : t("screens.profile.premium.title")}
            </ThemedText>

            <ThemedText
              style={[
                typography.caption,
                {
                  color: isPremium ? colors.textSecondary : colors.text,
                },
              ]}
            >
              {isPremium
                ? t("screens.profile.premium.active.description")
                : t("screens.profile.premium.description")}
            </ThemedText>
          </View>
        </View>
        <View
          style={[
            styles.premiumButton,
            {
              backgroundColor: isPremium
                ? colors.surface
                : (colors as any).cardGradientStart ?? colors.surface,
              borderWidth: isPremium ? 1 : 0,
              borderColor: isPremium ? colors.border : "transparent",
            },
          ]}
        >
          <ThemedText
            style={[
              typography.captionBold,
              { color: colors.text, textAlign: "center" },
            ]}
          >
            {isPremium
              ? t("screens.profile.premium.active.cta")
              : t("screens.profile.premium.cta")}
          </ThemedText>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  premiumCard: {
    borderRadius: spacing.xl,
    padding: spacing.xl,
    minHeight: 160,
    gap: spacing.sm,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  premiumHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  premiumTextContainer: {
    flex: 1,
    gap: spacing.xs,
  },
  premiumIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  premiumButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    backgroundColor: undefined,
    borderRadius: spacing.lg,
    alignSelf: "flex-start",
  },
});
