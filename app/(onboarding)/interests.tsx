import { BaseTemplateScreen } from "@/components/base-template-screen";
import InterestsSelector from "@/components/profile-edit/interests-selector";
import { ScreenBottomBar } from "@/components/screen-bottom-bar";
import { ThemedText } from "@/components/themed-text";
import { MIN_INTERESTS } from "@/constants/profile-options";
import { typography } from "@/constants/theme";
import { useOnboardingFlow } from "@/hooks/use-onboarding-flow";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useScreenTracking } from "@/modules/analytics";
import { t } from "@/modules/locales";
import { onboardingActions } from "@/modules/store/slices/onboardingActions";
import React, { useCallback, useState } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";

export default function InterestsScreen() {
  const colors = useThemeColors();
  const { userData, completeCurrentStep } = useOnboardingFlow();

  useScreenTracking({
    screenName: "onboarding_interests",
    params: {
      step_name: "interests",
    },
  });

  const [selectedKeys, setSelectedKeys] = useState<string[]>(
    userData.interests || [],
  );

  const isMinReached = selectedKeys.length >= MIN_INTERESTS;

  const handleContinue = useCallback(() => {
    if (selectedKeys.length >= MIN_INTERESTS) {
      onboardingActions.setInterests(selectedKeys);
      completeCurrentStep("interests");
    }
  }, [selectedKeys, completeCurrentStep]);

  return (
    <BaseTemplateScreen
      hasStackHeader
      BottomBar={
        <ScreenBottomBar
          primaryLabel={t("common.continue")}
          onPrimaryPress={handleContinue}
          primaryDisabled={!isMinReached}
          topContent={
            !isMinReached && selectedKeys.length > 0 ? (
              <ThemedText
                style={[
                  typography.caption,
                  { color: colors.error, textAlign: "center" },
                ]}
              >
                {t("screens.onboarding.interests.minRequired")}
              </ThemedText>
            ) : null
          }
        />
      }
    >
      <Animated.View entering={FadeInDown.duration(400)} style={{ flex: 1 }}>
        <InterestsSelector
          selectedKeys={selectedKeys}
          onSelectedKeysChange={setSelectedKeys}
        />
      </Animated.View>
    </BaseTemplateScreen>
  );
}
