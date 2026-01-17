import { BaseTemplateScreen } from "@/components/base-template-screen";
import {
  FavoritePlacesContent,
  useFavoritePlaces,
} from "@/components/favorite-places-manager";
import { MultiSelectSheet } from "@/components/multi-select-sheet";
import { ScreenBottomBar } from "@/components/screen-bottom-bar";
import { spacing } from "@/constants/theme";
import { useOnboardingFlow } from "@/hooks/use-onboarding-flow";
import { t } from "@/modules/locales";
import { onboardingActions } from "@/modules/store/slices/onboardingActions";
import React from "react";

export default function FavoritePlacesScreen() {
  const { completeCurrentStep } = useOnboardingFlow();

  const {
    selectedPlaceIds,
    placesMap,
    isExpanded,
    setIsExpanded,
    togglePlace,
    removePlace,
    handleOpenSearch,
    suggestedPlaces,
    isLoadingPlaces,
    locationLoading,
    getPlacesByCategory,
  } = useFavoritePlaces({});

  const handleSave = () => {
    if (selectedPlaceIds.length >= 1) {
      onboardingActions.setFavoritePlaces(selectedPlaceIds);
      completeCurrentStep("favorite-places");
    }
  };

  const allSelectedPlaces = selectedPlaceIds.map((id) => ({
    id,
    name: placesMap[id] || "...",
    category: "",
  }));

  return (
    <BaseTemplateScreen
      hasStackHeader
      useSafeArea={false}
      contentContainerStyle={{
        paddingBottom: spacing.xxl * 4,
      }}
      BottomBar={
        <ScreenBottomBar
          primaryLabel={t("common.continue")}
          onPrimaryPress={handleSave}
          primaryDisabled={selectedPlaceIds.length < 1}
          topContent={
            selectedPlaceIds.length > 0 ? (
              <MultiSelectSheet
                selectedItems={allSelectedPlaces}
                getItemId={(item) => item.id}
                getItemLabel={(item) => item.name}
                isExpanded={isExpanded}
                onToggleExpanded={() => setIsExpanded(!isExpanded)}
                onRemoveItem={removePlace}
              />
            ) : undefined
          }
        />
      }
    >
      <FavoritePlacesContent
        selectedPlaceIds={selectedPlaceIds}
        togglePlace={togglePlace}
        handleOpenSearch={handleOpenSearch}
        suggestedPlaces={suggestedPlaces}
        isLoadingPlaces={isLoadingPlaces}
        locationLoading={locationLoading}
        getPlacesByCategory={getPlacesByCategory}
        isExpanded={isExpanded}
        setIsExpanded={setIsExpanded}
      />
    </BaseTemplateScreen>
  );
}
