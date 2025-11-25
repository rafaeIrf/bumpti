import {
  CheckIcon,
  CrownIcon,
  FlameIcon,
  MapPinIcon,
  NavigationIcon,
  SettingsIcon,
} from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { useCustomBottomSheet } from "@/components/BottomSheetProvider/hooks";
import {
  PowerUpBottomSheet,
  PowerUpOptionConfig,
} from "@/components/power-up-bottom-sheet";
import { ProfileActionCard } from "@/components/profile-action-card";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useProfile } from "@/hooks/use-profile";
import { useAppSelector } from "@/modules/store/hooks";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SvgProps } from "react-native-svg";

interface BenefitRow {
  labelKey: string;
  free: boolean;
  premium: boolean;
}

type PowerUpType = "earlyCheckin" | "pings" | "turbo";

interface PowerUpConfig {
  icon: React.ComponentType<SvgProps>;
  translationKey: string;
  options: PowerUpOptionConfig[];
}

const POWER_UP_CONFIGS: Record<PowerUpType, PowerUpConfig> = {
  earlyCheckin: {
    icon: MapPinIcon,
    translationKey: "screens.profile.powerUps.earlyCheckin",
    options: [
      { quantity: 1, id: "single" },
      { quantity: 5, id: "bundle", badgeId: "popular", isHighlighted: true },
      { quantity: 10, id: "max" },
    ],
  },
  pings: {
    icon: NavigationIcon,
    translationKey: "screens.profile.powerUps.pings",
    options: [
      { quantity: 1, id: "single" },
      { quantity: 5, id: "bundle", badgeId: "popular", isHighlighted: true },
      { quantity: 10, id: "max" },
    ],
  },
  turbo: {
    icon: FlameIcon,
    translationKey: "screens.profile.powerUps.turbo",
    options: [
      { quantity: 1, id: "single" },
      { quantity: 3, id: "bundle", badgeId: "popular", isHighlighted: true },
      { quantity: 6, id: "max" },
    ],
  },
};

const BENEFITS: BenefitRow[] = [
  {
    labelKey: "screens.profile.benefits.unlimitedLikes",
    free: false,
    premium: true,
  },
  {
    labelKey: "screens.profile.benefits.seeWhoLiked",
    free: false,
    premium: true,
  },
  {
    labelKey: "screens.profile.benefits.priorityLikes",
    free: false,
    premium: true,
  },
  {
    labelKey: "screens.profile.benefits.unlimitedRewind",
    free: false,
    premium: true,
  },
  {
    labelKey: "screens.profile.benefits.visibilityControl",
    free: false,
    premium: true,
  },
  {
    labelKey: "screens.profile.benefits.seeWhoViewedYou",
    free: false,
    premium: true,
  },
  {
    labelKey: "screens.profile.benefits.turboWeekly",
    free: false,
    premium: true,
  },
  {
    labelKey: "screens.profile.benefits.earlyCheckinWeekly",
    free: false,
    premium: true,
  },
  {
    labelKey: "screens.profile.benefits.pingsWeekly",
    free: false,
    premium: true,
  },
];

export default function ProfileScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const bottomSheet = useCustomBottomSheet();
  const { profile } = useProfile();
  const onboardingUserData = useAppSelector((state) => state.onboarding.userData);

  const handleSettingsClick = () => {
    // TODO: Navigate to settings
    console.log("Settings clicked");
  };

  const handleCompleteProfile = () => {
    // TODO: Navigate to profile completion
    console.log("Complete profile clicked");
  };

  const handlePowerUpPurchase = (type: PowerUpType, quantity: number) => {
    console.log("Power-up purchase", type, quantity);
  };

  const openPowerUpSheet = (type: PowerUpType) => {
    if (!bottomSheet) return;
    const config = POWER_UP_CONFIGS[type];

    bottomSheet.expand({
      content: () => (
        <PowerUpBottomSheet
          translationKey={config.translationKey}
          icon={config.icon}
          options={config.options}
          onClose={() => bottomSheet.close()}
          onPurchase={(quantity) => {
            handlePowerUpPurchase(type, quantity);
            bottomSheet.close();
          }}
          onUpgradeToPremium={() => {
            bottomSheet.close();
            handlePremiumClick();
          }}
        />
      ),
      draggable: true,
    });
  };

  const handleTurboClick = () => {
    openPowerUpSheet("turbo");
  };

  const handlePingsClick = () => {
    openPowerUpSheet("pings");
  };

  const handleEarlyCheckinClick = () => {
    openPowerUpSheet("earlyCheckin");
  };

  const handlePremiumClick = () => {
    router.push("/premium-paywall");
  };

  const profilePhoto = profile?.photos?.[0]?.url ?? onboardingUserData.photoUris?.[0];

  return (
    <BaseTemplateScreen
      TopHeader={
        <ScreenToolbar
          title={t("screens.profile.title")}
          rightActions={[
            {
              icon: SettingsIcon,
              onClick: handleSettingsClick,
              ariaLabel: t("screens.profile.settings"),
            },
          ]}
        />
      }
    >
      <View style={[styles.content]}>
        {/* Profile Header */}
        <Animated.View
          entering={FadeInDown.duration(400)}
          style={styles.profileHeader}
        >
          {/* Profile Photo */}
          <View style={styles.photoContainer}>
            <View style={[styles.photoRing, { borderColor: colors.accent }]}>
              {profilePhoto ? (
                <Image source={{ uri: profilePhoto }} style={styles.photo} />
              ) : (
                <View
                  style={[
                    styles.photoPlaceholder,
                    { backgroundColor: colors.surface },
                  ]}
                />
              )}
            </View>
          </View>

          {/* Profile Info */}
          <View style={styles.profileInfo}>
            <ThemedText style={[typography.body1, { color: colors.text }]}>
              {profile?.name || t("screens.profile.title")}
              {profile?.age ? `, ${profile.age}` : ""}
            </ThemedText>

            <Button
              onPress={handleCompleteProfile}
              size="sm"
              style={styles.profileButton}
              label={t("screens.profile.completeProfile")}
            />
          </View>
        </Animated.View>

        {/* Action Cards */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(100)}
          style={styles.actionCardsContainer}
        >
          <ProfileActionCard
            icon={FlameIcon}
            titleKey={t("screens.profile.turbo.title")}
            onPress={handleTurboClick}
          />
          <ProfileActionCard
            icon={NavigationIcon}
            titleKey={t("screens.profile.pings.title")}
            onPress={handlePingsClick}
          />
          <ProfileActionCard
            icon={MapPinIcon}
            titleKey={t("screens.profile.earlyCheckin.title")}
            onPress={handleEarlyCheckinClick}
          />
        </Animated.View>

        {/* Premium Hero Card */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)}>
          <Pressable onPress={handlePremiumClick}>
            <LinearGradient
              colors={["#2997FF", "#0A0A0A"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.premiumCard}
            >
              <View style={styles.premiumHeader}>
                <View
                  style={[
                    styles.premiumIconContainer,
                    { backgroundColor: "rgba(255, 255, 255, 0.15)" },
                  ]}
                >
                  <CrownIcon width={24} height={24} color={colors.text} />
                </View>
                <View style={styles.premiumTextContainer}>
                  <ThemedText
                    style={[typography.body1, { color: colors.text }]}
                  >
                    {t("screens.profile.premium.title")}
                  </ThemedText>

                  <ThemedText
                    style={[typography.caption, { color: colors.text }]}
                  >
                    {t("screens.profile.premium.description")}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.premiumButton}>
                <ThemedText
                  style={[typography.captionBold, { color: colors.text }]}
                >
                  {t("screens.profile.premium.cta")}
                </ThemedText>
              </View>
            </LinearGradient>
          </Pressable>
        </Animated.View>

        {/* Benefits Table */}
        <Animated.View entering={FadeInDown.duration(400).delay(300)}>
          <LinearGradient
            colors={["#1C1C1C", "#0F0F0F"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.benefitsCard}
          >
            <ThemedText style={[typography.body, { color: colors.text }]}>
              {t("screens.profile.benefits.title")}
            </ThemedText>

            {/* Table Header */}
            <View
              style={[styles.tableHeader, { borderBottomColor: colors.border }]}
            >
              <View style={styles.tableHeaderCell} />
              <ThemedText
                style={[
                  typography.caption,
                  {
                    color: colors.textSecondary,
                    flex: 1,
                    textAlign: "center",
                  },
                ]}
              >
                {t("screens.profile.benefits.free")}
              </ThemedText>
              <ThemedText
                style={[
                  typography.caption,
                  { color: colors.accent, flex: 1, textAlign: "center" },
                ]}
              >
                {t("screens.profile.benefits.premium")}
              </ThemedText>
            </View>

            {/* Table Rows */}
            <View style={styles.tableBody}>
              {BENEFITS.map((benefit) => (
                <View key={benefit.labelKey} style={styles.tableRow}>
                  <ThemedText
                    style={[
                      typography.caption,
                      { color: colors.text, flex: 2 },
                    ]}
                  >
                    {t(benefit.labelKey)}
                  </ThemedText>
                  <View style={styles.tableCell}>
                    {benefit.free ? (
                      <CheckIcon width={16} height={16} color={colors.accent} />
                    ) : (
                      <View style={styles.iconPlaceholder}>
                        <ThemedText
                          style={[
                            typography.body,
                            { color: colors.textSecondary },
                          ]}
                        >
                          —
                        </ThemedText>
                      </View>
                    )}
                  </View>
                  <View style={styles.tableCell}>
                    {benefit.premium ? (
                      <CheckIcon width={16} height={16} color={colors.accent} />
                    ) : (
                      <View style={styles.iconPlaceholder}>
                        <ThemedText
                          style={[
                            typography.body,
                            { color: colors.textSecondary },
                          ]}
                        >
                          —
                        </ThemedText>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingTop: spacing.md,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  photoContainer: {
    flexShrink: 0,
  },
  photoRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2.5,
    padding: 0,
  },
  photo: {
    width: "100%",
    height: "100%",
    borderRadius: 37.5,
  },
  photoPlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 37.5,
  },
  profileInfo: {
    flex: 1,
  },
  profileButton: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
  },
  actionCardsContainer: {
    flexDirection: "row",
    gap: spacing.md,
  },
  premiumCard: {
    borderRadius: 16,
    padding: spacing.lg,
    minHeight: 140,
  },
  premiumHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: "#000000",
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  benefitsCard: {
    borderRadius: 16,
    padding: spacing.lg,
  },
  tableHeader: {
    flexDirection: "row",
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    marginBottom: spacing.sm,
  },
  tableHeaderCell: {
    flex: 2,
  },
  tableBody: {
    gap: spacing.xs,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  tableCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconPlaceholder: {
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
