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
import { useAppSelector } from "@/modules/store/hooks";
import React from "react";
import { StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

export default function SocialHubsIntroScreen() {
  const { completeCurrentStep } = useOnboardingFlow();
  const colors = useThemeColors();
  const userName =
    useAppSelector((state) => state.onboarding.userData.name) || "";

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
          primaryLabel={t("common.continue")}
          onPrimaryPress={() => completeCurrentStep("social-hubs-intro")}
        />
      }
    >
      <ThemedView style={styles.container}>
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <ThemedText
            style={[
              typography.subheading,
              styles.title,
              { color: colors.text },
            ]}
          >
            {t("screens.onboarding.socialHubsIntro.title", { name: userName })}
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <CurrentLocation
            width={240}
            height={240}
            style={styles.illustration}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(350).springify()}>
          <ThemedText
            style={[
              typography.body,
              styles.description,
              { color: colors.textSecondary },
            ]}
          >
            {t("screens.onboarding.socialHubsIntro.description")}
          </ThemedText>
        </Animated.View>
      </ThemedView>
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: spacing.xxl * 2,
  },
  illustration: {
    marginBottom: spacing.lg,
  },
  title: {
    textAlign: "left",
    marginBottom: spacing.lg,
    marginTop: spacing.md,
  },
  description: {
    textAlign: "center",
    maxWidth: 320,
  },
});
