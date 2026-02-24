import { ArrowRightIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import InterestsSelector from "@/components/profile-edit/interests-selector";
import { ScreenBottomBar } from "@/components/screen-bottom-bar";
import { useOnboardingFlow } from "@/hooks/use-onboarding-flow";
import { useScreenTracking } from "@/modules/analytics";
import { t } from "@/modules/locales";
import { onboardingActions } from "@/modules/store/slices/onboardingActions";
import React, { useCallback, useState } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";

export default function InterestsScreen() {
  const { userData, completeCurrentStep} = useOnboardingFlow();

  useScreenTracking({
    screenName: "onboarding_interests",
    params: {
      step_name: "interests",
    },
  });

  const [selectedKeys, setSelectedKeys] = useState<string[]>(
    userData.interests || [],
  );

  const handleContinue = useCallback(() => {
    if (selectedKeys.length > 0) {
      onboardingActions.setInterests(selectedKeys);
    }
    completeCurrentStep("interests");
  }, [selectedKeys, completeCurrentStep]);

  return (
    <BaseTemplateScreen
      hasStackHeader
      BottomBar={
        <ScreenBottomBar
          variant="wizard"
          onPrimaryPress={handleContinue}
          primaryDisabled={false}
          primaryIcon={ArrowRightIcon}
          secondaryLabel={t("common.skip")}
          onSecondaryPress={() => completeCurrentStep("interests")}
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
