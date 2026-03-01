import { ArrowLeftIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { MultiSelectSheet } from "@/components/multi-select-sheet";
import { ScreenBottomBar } from "@/components/screen-bottom-bar";
import { ScreenToolbar } from "@/components/screen-toolbar";
import {
  SocialHubsContent,
  mapCategoryToGridId,
  mapGridIdToCategory,
  socialHubsStyles as styles,
  useSocialHubs,
} from "@/components/social-hubs-manager";
import { t } from "@/modules/locales";
import { updateProfile } from "@/modules/profile/api";
import { useAppDispatch, useAppSelector } from "@/modules/store/hooks";
import { setProfile } from "@/modules/store/slices/profileSlice";
import { logger } from "@/utils/logger";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo } from "react";

export default function EditSocialHubsScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const profile = useAppSelector((state) => state.profile.data);

  const initialHubs = useMemo(() => {
    const hubs: Record<string, string> = {};
    (profile?.socialHubs ?? []).forEach((h: any) => {
      hubs[h.id || h.place_id] = h.name || "";
    });
    return hubs;
  }, [profile?.socialHubs]);

  const initialCategories = useMemo(() => {
    const cats: Record<string, string> = {};
    (profile?.socialHubs ?? []).forEach((h: any) => {
      const placeId = h.id || h.place_id;
      if (h.category) {
        cats[placeId] = mapCategoryToGridId(h.category);
      }
    });
    return cats;
  }, [profile?.socialHubs]);

  const {
    selectedPlaceIds,
    selectedHubs,
    hubCategories,
    isExpanded,
    setIsExpanded,
    getCountForCategory,
    handleCategoryPress,
    handleRemoveHub,
    allSelectedPlaces,
  } = useSocialHubs({
    initialSelectedHubs: initialHubs,
    initialHubCategories: initialCategories,
    searchPath: "/(modals)/place-search",
  });

  const handleSave = useCallback(() => {
    if (profile) {
      const socialHubs = selectedPlaceIds.map((id) => ({
        id,
        name: selectedHubs[id] || "",
        category: mapGridIdToCategory(hubCategories[id] || ""),
      }));
      const updatedProfile = { ...profile, socialHubs };

      // Optimistic update
      dispatch(setProfile(updatedProfile));

      // Background API update
      updateProfile({ socialHubs: selectedPlaceIds }).catch((error) => {
        logger.error("Failed to update social hubs", error);
      });
    }

    router.back();
  }, [
    profile,
    selectedPlaceIds,
    selectedHubs,
    hubCategories,
    dispatch,
    router,
  ]);

  return (
    <BaseTemplateScreen
      contentContainerStyle={styles.screenContent}
      TopHeader={
        <ScreenToolbar
          title={t("screens.profile.profileEdit.interests.socialHubs")}
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
