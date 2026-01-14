import { XIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { LoadingView } from "@/components/loading-view";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { UserProfileCard } from "@/components/user-profile-card";
import { spacing, typography } from "@/constants/theme";
import { useCachedProfile } from "@/hooks/use-cached-profile";
import { useProfile } from "@/hooks/use-profile";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { ActiveUserAtPlace } from "@/modules/presence/api";
import { prefetchImages } from "@/utils/image-prefetch";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

export default function ProfilePreviewModal() {
  const { profile: myProfile, isLoading: isMyProfileLoading } = useProfile();
  const colors = useThemeColors();
  const router = useRouter();
  const params = useLocalSearchParams<{
    userId?: string;
    initialProfile?: string;
  }>();

  const isScanningOther = !!params.userId;

  // Hook para buscar perfil cacheado de outro usuário
  const {
    profileData: cachedProfileData,
    isLoading: isCachedProfileLoading,
    isRefreshing,
    refresh,
    error: cachedProfileError,
  } = useCachedProfile(params.userId, { enabled: isScanningOther });

  // Estado para initialProfile vindo dos params (para compatibilidade)
  const [otherUserProfile, setOtherUserProfile] =
    useState<ActiveUserAtPlace | null>(() => {
      if (params.initialProfile) {
        try {
          return JSON.parse(params.initialProfile);
        } catch (e) {
          // Usando logger invés de console
          return null;
        }
      }
      return null;
    });

  // Sync state if params change while mounted
  useEffect(() => {
    if (params.initialProfile) {
      try {
        const parsed = JSON.parse(params.initialProfile);
        setOtherUserProfile(parsed);
      } catch (e) {
        // Silently fail
      }
    }
  }, [params.initialProfile]);

  const profileCardData: ActiveUserAtPlace | null = useMemo(() => {
    if (isScanningOther) {
      // Se temos dados do cache, usar eles
      if (cachedProfileData) {
        return {
          user_id: cachedProfileData.user_id,
          name: cachedProfileData.name,
          age: cachedProfileData.age,
          bio: cachedProfileData.bio,
          intentions: cachedProfileData.intentions,
          photos: cachedProfileData.photos,
          job_title: cachedProfileData.job_title,
          company_name: cachedProfileData.company_name,
          height_cm: cachedProfileData.height_cm,
          location: cachedProfileData.location,
          languages: cachedProfileData.languages,
          relationship_status: cachedProfileData.relationship_status,
          smoking_habit: cachedProfileData.smoking_habit,
          education_level: cachedProfileData.education_level,
          zodiac_sign: cachedProfileData.zodiac_sign,
          verification_status: cachedProfileData.verification_status ?? null,
          entered_at: "",
          expires_at: "",
          visited_places_count: cachedProfileData.visited_places_count,
          favorite_places: cachedProfileData.favorite_places,
        };
      }
      
      // Fallback para initialProfile dos params (compatibilidade)
      return otherUserProfile;
    }

    if (!myProfile) return null;

    const photos =
      myProfile.photos?.map((p) => p.url).filter((url) => !!url) ?? [];

    const favoritePlacesIds =
      myProfile.favoritePlaces?.map((p: any) => ({
        id: p.id || p.place_id,
        name: p.name,
        emoji: p.emoji,
      })) ?? [];

    return {
      user_id: myProfile.id || "me",
      name: myProfile.name ?? "",
      age: myProfile.age ?? null,
      bio: myProfile.bio ?? null,
      intentions: (myProfile.intentions ?? []).map((intent) => String(intent)),
      photos,
      job_title: myProfile.job_title ?? null,
      company_name: myProfile.company_name ?? null,
      height_cm: myProfile.height_cm ?? null,
      location: myProfile.location ?? null,
      languages: myProfile.languages ?? [],
      relationship_status: myProfile.relationship_key ?? null,
      smoking_habit: myProfile.smoking_key ?? null,
      education_level: myProfile.education_key ?? null,
      zodiac_sign: myProfile.zodiac_key ?? null,
      verification_status: myProfile.verification_status ?? null,
      entered_at: "",
      expires_at: "",
      visited_places_count: favoritePlacesIds.length,
      favorite_places: favoritePlacesIds,
    };
  }, [isScanningOther, cachedProfileData, otherUserProfile, myProfile]);

  // Loading state
  const isLoading = isScanningOther 
    ? isCachedProfileLoading 
    : isMyProfileLoading;

  const handleRefresh = async () => {
    if (isScanningOther && refresh) {
      await refresh();
    }
  };

  // Prefetch profile photos as backup (in case they weren't prefetched during cache)
  useEffect(() => {
    if (profileCardData?.photos && profileCardData.photos.length > 0) {
      const photoUrls = profileCardData.photos.filter((url) => !!url);
      if (photoUrls.length > 0) {
        prefetchImages(photoUrls);
      }
    }
  }, [profileCardData?.photos]);

  return (
    <BaseTemplateScreen
      contentContainerStyle={styles.container}
      isModal
      refreshing={isRefreshing}
      onRefresh={isScanningOther ? handleRefresh : undefined}
      TopHeader={
        <ScreenToolbar
          title={profileCardData?.name || t("screens.profile.preview.title")}
          leftAction={{
            icon: XIcon,
            onClick: () => router.back(),
            ariaLabel: t("common.back"),
          }}
        />
      }
    >
      <ThemedView style={styles.content}>
        {isLoading ? (
          <LoadingView />
        ) : !profileCardData ? (
          <View style={styles.errorContainer}>
            <ThemedText style={typography.body}>
              {cachedProfileError || t("errors.profileUnavailable")}
            </ThemedText>
          </View>
        ) : (
          <UserProfileCard profile={profileCardData} />
        )}
      </ThemedView>
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 0,
  },
  content: {
    flex: 1,
    paddingBottom: spacing.xl,
    justifyContent: "center",
  },
  errorContainer: {
    alignItems: "center",
    padding: spacing.lg,
  },
});
