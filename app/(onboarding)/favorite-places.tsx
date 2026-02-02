import { BaseTemplateScreen } from "@/components/base-template-screen";
import {
  FavoritePlacesContent,
  useFavoritePlaces,
} from "@/components/favorite-places-manager";
import { MultiSelectSheet } from "@/components/multi-select-sheet";
import { ScreenBottomBar } from "@/components/screen-bottom-bar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { spacing } from "@/constants/theme";
import { useCachedLocation } from "@/hooks/use-cached-location";
import { useOnboardingFlow } from "@/hooks/use-onboarding-flow";
import { t } from "@/modules/locales";
import { onboardingActions } from "@/modules/store/slices/onboardingActions";
import React from "react";

export default function FavoritePlacesScreen() {
  const { completeCurrentStep } = useOnboardingFlow();
  const { location: userLocation } = useCachedLocation();

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
  } = useFavoritePlaces({ searchPath: "./place-search" });

  // Check if we have no suggested places after loading completes (city not supported)
  // Need to check if any category has actual places, not just if the categories array exists
  const hasSuggestedPlaces =
    suggestedPlaces &&
    suggestedPlaces.length > 0 &&
    suggestedPlaces.some(
      (category) => category.places && category.places.length > 0,
    );

  const isCityNotAvailable =
    !isLoadingPlaces && !locationLoading && userLocation && !hasSuggestedPlaces;

  const handleContinue = () => {
    // Allow continue even without selections if city is not available
    if (isCityNotAvailable || selectedPlaceIds.length >= 1) {
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
        userLocation && (
          <ScreenBottomBar
            primaryLabel={t("common.continue")}
            onPrimaryPress={handleContinue}
            primaryDisabled={!isCityNotAvailable && selectedPlaceIds.length < 1}
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
        )
      }
    >
      {isCityNotAvailable ? (
        <ThemedView
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: spacing.xxl,
          }}
        >
          <ThemedText
            style={{
              fontSize: 24,
              fontWeight: "600",
              lineHeight: 32,
              marginBottom: spacing.md,
              textAlign: "center",
              color: "#FFFFFF",
            }}
          >
            {t("screens.onboarding.cityNotAvailable.title")}
          </ThemedText>
          <ThemedText
            style={{
              fontSize: 16,
              lineHeight: 24,
              textAlign: "center",
              maxWidth: 320,
              marginBottom: spacing.lg,
              color: "#8B98A5",
            }}
          >
            {t("screens.onboarding.cityNotAvailable.subtitle")}
          </ThemedText>
        </ThemedView>
      ) : (
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
          onLocationSkip={() => completeCurrentStep("favorite-places")}
        />
      )}
    </BaseTemplateScreen>
  );
}
