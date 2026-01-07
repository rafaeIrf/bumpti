import {
  CircleCheckDashedIcon,
  MapPinIcon,
  PencilIcon,
  SettingsIcon,
} from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { BenefitsTable } from "@/components/benefits-table";
import { useCustomBottomSheet } from "@/components/BottomSheetProvider/hooks";
import { CheckinCreditsCard } from "@/components/checkin-credits-card";
import {
  PowerUpBottomSheet,
  PowerUpOptionConfig,
  PowerUpType,
} from "@/components/power-up-bottom-sheet";
import { PremiumStatusCard } from "@/components/premium/premium-status-card";
import { ProfilePhotoProgress } from "@/components/profile/profile-photo-progress";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useProfile } from "@/hooks/use-profile";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useUserSubscription } from "@/modules/iap/hooks";
import { t } from "@/modules/locales";
import { useAppSelector } from "@/modules/store/hooks";
import { logger } from "@/utils/logger";
import { calculateProfileCompletion } from "@/utils/profile-completion";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SvgProps } from "react-native-svg";

// Only earlyCheckin is currently supported for purchase
interface PowerUpConfig {
  icon: React.ComponentType<SvgProps>;
  translationKey: string;
  options: PowerUpOptionConfig[];
  powerUpType: PowerUpType;
}

const EARLY_CHECKIN_CONFIG: PowerUpConfig = {
  icon: MapPinIcon,
  translationKey: "screens.profile.powerUps.earlyCheckin",
  powerUpType: "earlyCheckin",
  options: [
    { quantity: 1, id: "single" },
    { quantity: 5, id: "bundle", badgeId: "popular", isHighlighted: true },
    { quantity: 10, id: "max" },
  ],
};

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
  const { checkinCredits, isPremium } = useUserSubscription();

  // const isPremium = false;

  const handleSettingsClick = () => {
    router.push("/main/settings");
  };

  const handleCompleteProfile = () => {
    router.push("/(profile)/edit");
  };

  const openEarlyCheckinSheet = () => {
    if (!bottomSheet) return;
    const config = EARLY_CHECKIN_CONFIG;

    bottomSheet.expand({
      content: () => (
        <PowerUpBottomSheet
          translationKey={config.translationKey}
          powerUpType={config.powerUpType}
          icon={config.icon}
          options={config.options}
          onClose={() => bottomSheet.close()}
          onPurchaseComplete={() => {
            logger.log("[Profile] Power-up purchase completed: earlyCheckin");
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

  const handleEarlyCheckinClick = () => {
    openEarlyCheckinSheet();
  };

  const handlePremiumClick = () => {
    if (isPremium) {
      router.push("/(modals)/manage-subscription");
    } else {
      router.push("/(modals)/premium-paywall");
    }
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
            <ProfilePhotoProgress
              photoUrl={profilePhoto}
              progress={profileProgress}
              onPress={handleOpenProfilePreview}
              completionText={completionText}
            />

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

          {/* Check-in+ Card */}
          <Animated.View
            entering={FadeInDown.duration(400).delay(100)}
            style={styles.checkinCardContainer}
          >
            <CheckinCreditsCard
              credits={checkinCredits}
              onPurchase={handleEarlyCheckinClick}
            />
          </Animated.View>
        </View>

        {/* Content Body */}
        <View style={styles.bodyContent}>
          {/* Premium Hero Card */}
          <Animated.View entering={FadeInDown.duration(400).delay(200)}>
            <PremiumStatusCard
              isPremium={isPremium}
              onPress={handlePremiumClick}
            />
          </Animated.View>

          {/* Benefits Table */}
          <Animated.View entering={FadeInDown.duration(400).delay(300)}>
            <BenefitsTable />
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
  profileInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  profileButton: {
    alignSelf: "flex-start",
    marginTop: spacing.xs,
  },
  checkinCardContainer: {
    marginTop: spacing.lg,
  },
  progressBadge: {
    position: "absolute",
    bottom: -spacing.xs,
    alignSelf: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: spacing.lg,
    borderWidth: 1,
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
