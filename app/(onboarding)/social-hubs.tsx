import { BaseTemplateScreen } from "@/components/base-template-screen";
import { MultiSelectSheet } from "@/components/multi-select-sheet";
import { ScreenBottomBar } from "@/components/screen-bottom-bar";
import {
  SocialHubsContent,
  socialHubsStyles as styles,
  useSocialHubs,
} from "@/components/social-hubs-manager";
import { useOnboardingFlow } from "@/hooks/use-onboarding-flow";
import { useScreenTracking } from "@/modules/analytics";
import { t } from "@/modules/locales";
import { onboardingActions } from "@/modules/store/slices/onboardingActions";
import React, { useCallback } from "react";

export default function SocialHubsScreen() {
  const { completeCurrentStep } = useOnboardingFlow();

  useScreenTracking({
    screenName: "onboarding_social_hubs",
    params: { step_name: "social_hubs" },
  });

  const {
    selectedPlaceIds,
    isExpanded,
    setIsExpanded,
    getCountForCategory,
    handleCategoryPress,
    handleRemoveHub,
    allSelectedPlaces,
  } = useSocialHubs({
    searchPath: "/(onboarding)/place-search",
  });

  const handleContinue = useCallback(() => {
    if (selectedPlaceIds.length > 0) {
      onboardingActions.setSocialHubs(selectedPlaceIds);
    }
    completeCurrentStep("social-hubs");
  }, [selectedPlaceIds, completeCurrentStep]);

  return (
    <BaseTemplateScreen
      hasStackHeader
      useSafeArea={false}
      contentContainerStyle={styles.screenContent}
      BottomBar={
        <ScreenBottomBar
          variant="single"
          primaryLabel={t("common.continue")}
          onPrimaryPress={handleContinue}
          primaryDisabled={selectedPlaceIds.length === 0}
          topContent={
            selectedPlaceIds.length > 0 ? (
              <MultiSelectSheet
                selectedItems={allSelectedPlaces}
                getItemId={(item) => item.id}
                getItemLabel={(item) => item.name}
                isExpanded={isExpanded}
                onToggleExpanded={() => setIsExpanded(!isExpanded)}
                onRemoveItem={(item) => handleRemoveHub(item.id)}
              />
            ) : undefined
          }
        />
      }
    >
      <SocialHubsContent
        selectedPlaceIds={selectedPlaceIds}
        getCountForCategory={getCountForCategory}
        handleCategoryPress={handleCategoryPress}
      />
    </BaseTemplateScreen>
  );
}
