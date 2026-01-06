import {
  CheckIcon,
  CircleCheckDashedIcon,
  CrownIcon,
  FlameIcon,
  MapPinIcon,
  NavigationIcon,
  PencilIcon,
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
import { RemoteImage } from "@/components/ui/remote-image";
import { spacing, typography } from "@/constants/theme";
import { useProfile } from "@/hooks/use-profile";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { useAppSelector } from "@/modules/store/hooks";
import { calculateProfileCompletion } from "@/utils/profile-completion";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, SvgProps } from "react-native-svg";

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
  const onboardingUserData = useAppSelector(
    (state) => state.onboarding.userData
  );
  const insets = useSafeAreaInsets();

  const [profileProgress, setProfileProgress] = React.useState<number>(0.65);

  const handleSettingsClick = () => {
    router.push("/main/settings");
  };

  const handleCompleteProfile = () => {
    router.push("/(profile)/edit");
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
    router.push("/(modals)/premium-paywall");
  };

  const handleOpenProfilePreview = () => {
    router.push("/(modals)/profile-preview");
  };

  const profilePhoto =
    profile?.photos?.[0]?.url ?? onboardingUserData.photoUris?.[0];

  const ageText = React.useMemo(() => {
    if (!profile?.age) return "";
    return `, ${profile.age}`;
  }, [profile?.age]);

  // Update progress from profile data
  React.useEffect(() => {
    const completion = calculateProfileCompletion(profile);
    setProfileProgress(completion);
  }, [profile]);

  const completionText = `${Math.round(profileProgress * 100)}%`;
  const shouldShowCompletionBadge = profileProgress < 1;

  return (
    <BaseTemplateScreen
      useSafeArea={false}
      contentContainerStyle={{ paddingHorizontal: 0 }}
    >
      <View style={[styles.content]}>
        {/* Header Container (Toolbar + Info + Cards) */}
        <View
          style={[
            styles.headerContainer,
            {
              backgroundColor: colors.surface,
              paddingTop: insets.top,
              borderBottomLeftRadius: spacing.xl,
              borderBottomRightRadius: spacing.xl,
            },
          ]}
        >
          <View style={{ marginHorizontal: -spacing.md }}>
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
          </View>

          {/* Profile Header */}
          <Animated.View
            entering={FadeInDown.duration(400)}
            style={styles.profileHeader}
          >
            {/* Profile Photo */}
            <Pressable
              onPress={handleOpenProfilePreview}
              accessibilityRole="button"
              style={styles.photoContainer}
            >
              <View style={styles.photoRing}>
                <Svg width={80} height={80} style={StyleSheet.absoluteFill}>
                  {/* Background circle */}
                  <Circle
                    cx="40"
                    cy="40"
                    r="37"
                    stroke={(colors as any).border ?? colors.surface}
                    strokeWidth="5"
                    fill="none"
                  />
                  {/* Progress circle */}
                  <Circle
                    cx="40"
                    cy="40"
                    r="37"
                    stroke={(colors as any).premiumBlue ?? colors.accent}
                    strokeWidth="5"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 37}`}
                    strokeDashoffset={`${
                      2 * Math.PI * 37 * (1 - profileProgress)
                    }`}
                    strokeLinecap="round"
                    rotation="-90"
                    origin="40, 40"
                  />
                </Svg>
                <View
                  style={[
                    styles.photoTrack,
                    { backgroundColor: colors.background },
                  ]}
                >
                  {profilePhoto ? (
                    <RemoteImage
                      source={{ uri: profilePhoto }}
                      style={styles.photo}
                      contentFit="cover"
                    />
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
              {shouldShowCompletionBadge && (
                <View
                  style={[
                    styles.progressBadge,
                    {
                      backgroundColor:
                        (colors as any).cardGradientStart ?? colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <ThemedText
                    style={[typography.captionBold, { color: colors.text }]}
                  >
                    {completionText}
                  </ThemedText>
                </View>
              )}
            </Pressable>

            {/* Profile Info */}
            <View style={styles.profileInfo}>
              <View style={styles.profileInfoTextContainer}>
                <ThemedText
                  style={[typography.subheading2, { color: colors.text }]}
                >
                  {profile?.name || t("screens.profile.title")}
                  {ageText}
                </ThemedText>
                <CircleCheckDashedIcon
                  width={24}
                  height={24}
                  color={colors.textSecondary}
                />
              </View>

              <Button
                onPress={handleCompleteProfile}
                size="sm"
                leftIcon={<PencilIcon />}
                style={styles.profileButton}
                label={
                  profileProgress >= 1
                    ? t("screens.profile.editProfile")
                    : t("screens.profile.completeProfile")
                }
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
              title={t("screens.profile.turbo.title")}
              onPress={handleTurboClick}
            />
            <ProfileActionCard
              icon={NavigationIcon}
              title={t("screens.profile.pings.title")}
              onPress={handlePingsClick}
            />
            <ProfileActionCard
              icon={MapPinIcon}
              title={t("screens.profile.earlyCheckin.title")}
              onPress={handleEarlyCheckinClick}
            />
          </Animated.View>
        </View>

        {/* Content Body */}
        <View style={styles.bodyContent}>
          {/* Premium Hero Card */}
          <Animated.View entering={FadeInDown.duration(400).delay(200)}>
            <Pressable onPress={handlePremiumClick}>
              <LinearGradient
                colors={[
                  (colors as any).premiumBlue ?? colors.accent,
                  (colors as any).premiumBlueDark ?? colors.surface,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.premiumCard,
                  {
                    shadowColor: (colors as any).premiumBlue ?? colors.accent,
                  },
                ]}
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
                <View
                  style={[
                    styles.premiumButton,
                    {
                      backgroundColor:
                        (colors as any).cardGradientStart ?? colors.surface,
                    },
                  ]}
                >
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
              colors={[
                (colors as any).cardGradientStart ?? colors.surface,
                (colors as any).cardGradientEnd ?? colors.surface,
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.benefitsCard}
            >
              <ThemedText style={[typography.body, { color: colors.text }]}>
                {t("screens.profile.benefits.title")}
              </ThemedText>

              {/* Table Header */}
              <View
                style={[
                  styles.tableHeader,
                  { borderBottomColor: colors.border },
                ]}
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
                        <CheckIcon
                          width={16}
                          height={16}
                          color={colors.accent}
                        />
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
                        <CheckIcon
                          width={16}
                          height={16}
                          color={colors.accent}
                        />
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
      </View>
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    // Gap handled by padding in bodyContent and headerContainer structure
  },
  headerContainer: {
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  bodyContent: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
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
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  photoTrack: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photo: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  photoPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  profileInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  profileButton: {
    alignSelf: "flex-start",
    marginTop: spacing.xs,
  },
  actionCardsContainer: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
    alignItems: "stretch",
  },
  progressBadge: {
    position: "absolute",
    bottom: -spacing.sm,
    alignSelf: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: spacing.lg,
    borderWidth: 1,
  },
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
  benefitsCard: {
    borderRadius: spacing.xl,
    padding: spacing.xl,
    gap: spacing.md,
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
  profileInfoTextContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
});
