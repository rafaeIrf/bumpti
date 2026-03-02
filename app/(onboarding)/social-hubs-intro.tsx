import { MapPinIcon, SparklesIcon, UsersIcon } from "@/assets/icons";
import { CurrentLocation } from "@/assets/illustrations";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ScreenBottomBar } from "@/components/screen-bottom-bar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { spacing, typography } from "@/constants/theme";
import { useOnboardingFlow } from "@/hooks/use-onboarding-flow";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useScreenTracking } from "@/modules/analytics";
import { t } from "@/modules/locales";
import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SvgProps } from "react-native-svg";

interface BenefitRowProps {
  icon: React.ComponentType<SvgProps & { color?: string }>;
  title: string;
  body: string;
}

function BenefitRow({ icon: Icon, title, body }: BenefitRowProps) {
  const colors = useThemeColors();
  return (
    <View style={styles.benefitRow}>
      <View style={[styles.iconCircle, { backgroundColor: colors.surface }]}>
        <Icon width={18} height={18} color={colors.accent} />
      </View>
      <View style={styles.benefitText}>
        <ThemedText
          style={[typography.body, styles.benefitTitle, { color: colors.text }]}
        >
          {title}
        </ThemedText>
        <ThemedText
          style={[typography.caption, { color: colors.textSecondary }]}
        >
          {body}
        </ThemedText>
      </View>
    </View>
  );
}

export default function SocialHubsIntroScreen() {
  const { completeCurrentStep, userData } = useOnboardingFlow();
  const colors = useThemeColors();
  const userName = userData.name || "";

  useScreenTracking({
    screenName: "onboarding_social_hubs_intro",
    params: { step_name: "social_hubs_intro" },
  });

  return (
    <BaseTemplateScreen
      hasStackHeader
      useSafeArea={false}
      BottomBar={
        <ScreenBottomBar
          variant="single"
          primaryLabel={t("screens.onboarding.socialHubsIntro.button")}
          onPrimaryPress={() => completeCurrentStep("social-hubs-intro")}
        />
      }
    >
      <ThemedView style={styles.container}>
        {/* Illustration */}
        <Animated.View
          entering={FadeInDown.delay(80).springify()}
          style={styles.illustrationWrapper}
        >
          <CurrentLocation width={140} height={140} />
        </Animated.View>

        {/* Title + tagline */}
        <Animated.View
          entering={FadeInDown.delay(180).springify()}
          style={styles.headerBlock}
        >
          <ThemedText
            style={[typography.heading, styles.title, { color: colors.text }]}
          >
            {t("screens.onboarding.socialHubsIntro.title")}
          </ThemedText>
          <ThemedText
            style={[
              typography.body,
              styles.tagline,
              { color: colors.textSecondary },
            ]}
          >
            {t("screens.onboarding.socialHubsIntro.tagline", {
              name: userName,
            })}
          </ThemedText>
        </Animated.View>

        {/* Benefits */}
        <Animated.View
          entering={FadeInDown.delay(300).springify()}
          style={styles.benefitsBlock}
        >
          <BenefitRow
            icon={MapPinIcon}
            title={t("screens.onboarding.socialHubsIntro.benefit1Title")}
            body={t("screens.onboarding.socialHubsIntro.benefit1Body")}
          />
          <BenefitRow
            icon={UsersIcon}
            title={t("screens.onboarding.socialHubsIntro.benefit2Title")}
            body={t("screens.onboarding.socialHubsIntro.benefit2Body")}
          />
          <BenefitRow
            icon={SparklesIcon}
            title={t("screens.onboarding.socialHubsIntro.benefit3Title")}
            body={t("screens.onboarding.socialHubsIntro.benefit3Body")}
          />
        </Animated.View>
      </ThemedView>
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  illustrationWrapper: {
    alignItems: "center",
  },
  headerBlock: {
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  title: {
    textAlign: "center",
  },
  tagline: {
    textAlign: "center",
    opacity: 0.75,
  },
  benefitsBlock: {
    alignSelf: "stretch",
    gap: spacing.sm,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  benefitText: {
    flex: 1,
    gap: 2,
    paddingTop: spacing.xs / 2,
  },
  benefitTitle: {
    fontWeight: "600",
  },
});
