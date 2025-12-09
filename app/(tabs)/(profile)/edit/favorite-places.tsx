import { ArrowLeftIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import {
  FavoritePlacesContent,
  useFavoritePlaces,
} from "@/components/favorite-places-manager";
import { MultiSelectSheet } from "@/components/multi-select-sheet";
import { ScreenBottomBar } from "@/components/screen-bottom-bar";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { t } from "@/modules/locales";
import { updateProfile } from "@/modules/profile/api";
import { useAppDispatch, useAppSelector } from "@/modules/store/hooks";
import { setProfile } from "@/modules/store/slices/profileSlice";
import { logger } from "@/utils/logger";
import { navigateToNextProfileField } from "@/utils/profile-flow";
import { useRouter } from "expo-router";
import React from "react";

export default function EditFavoritePlacesScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const profile = useAppSelector((state) => state.profile.data);

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
  } = useFavoritePlaces({
    initialSelectedIds: profile?.favoritePlaces?.map((p: any) => p.id) || [],
    initialPlacesMap:
      profile?.favoritePlaces?.reduce(
        (acc: any, p: any) => ({ ...acc, [p.id]: p.name }),
        {}
      ) || {},
  });

  const handleSave = () => {
    if (profile) {
      const favoritePlaces = selectedPlaceIds.map((id) => ({
        id,
        name: placesMap[id] || "Unknown Place",
      }));
      const updatedProfile = { ...profile, favoritePlaces };

      // Optimistic update
      dispatch(setProfile(updatedProfile));

      // Background API update
      updateProfile({ favoritePlaces: selectedPlaceIds }).catch((error) => {
        logger.error("Failed to update favorite places", error);
      });

      navigateToNextProfileField("spots", updatedProfile);
    } else {
      router.back();
    }
  };

  const allSelectedPlaces = selectedPlaceIds.map((id) => ({
    id,
    name: placesMap[id] || "...",
    category: "",
  }));

  return (
    <BaseTemplateScreen
      isModal
      TopHeader={
        <ScreenToolbar
          title={t("screens.profile.profileEdit.interests.spots")}
          leftAction={{
            icon: ArrowLeftIcon,
            onClick: () => router.back(),
            ariaLabel: t("common.back"),
          }}
        />
      }
      BottomBar={
        <ScreenBottomBar
          primaryLabel={t("common.save")}
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
