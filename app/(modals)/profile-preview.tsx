import { XIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ItsMatchModal } from "@/components/its-match-modal";
import { LoadingView } from "@/components/loading-view";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { UserProfileCard } from "@/components/user-profile-card";
import { spacing, typography } from "@/constants/theme";
import { useCachedProfile } from "@/hooks/use-cached-profile";
import { useEncounterActions } from "@/hooks/use-encounter-actions";
import { useProfile } from "@/hooks/use-profile";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { DiscoverEncounter } from "@/modules/discover/types";
import { t } from "@/modules/locales";
import { ActiveUserAtPlace } from "@/modules/presence/api";
import { prefetchImages } from "@/utils/image-prefetch";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function ProfilePreviewModal() {
  const { profile: myProfile, isLoading: isMyProfileLoading } = useProfile();
  const colors = useThemeColors();
  const router = useRouter();
  const params = useLocalSearchParams<{
    userId?: string;
    initialProfile?: string;
    source?: string;
    placeId?: string;
    encounterType?: string;
  }>();

  const isFromDiscover = params.source === "discover";
  const isScanningOther = !!params.userId;

  // Hook para buscar perfil cacheado de outro usuário
  const {
    profileData: cachedProfileData,
    isLoading: isCachedProfileLoading,
    isRefreshing,
    refresh,
    error: cachedProfileError,
  } = useCachedProfile(params.userId, { enabled: isScanningOther });

  console.log("cachedProfileData", cachedProfileData);

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
          interests: cachedProfileData.interests,
          university_id: cachedProfileData.university_id,
          university_name: cachedProfileData.university_name,
          university_name_custom: cachedProfileData.university_name_custom,
          graduation_year: cachedProfileData.graduation_year,
          show_university_on_home: cachedProfileData.show_university_on_home,
          social_hubs: cachedProfileData.social_hubs,
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
      user_id: myProfile.id || "",
      name: myProfile.name ?? "",
      age: myProfile.age ?? null,
      bio: myProfile.bio ?? null,
      intentions: (myProfile.intentions ?? []).map((intent) => String(intent)),
      interests: (myProfile.interests ?? []).map((i) => String(i)),
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
      university_id: myProfile.university_id ?? null,
      university_name: myProfile.university_name ?? null,
      university_name_custom: myProfile.university_name_custom ?? null,
      graduation_year: myProfile.graduation_year ?? null,
      show_university_on_home: myProfile.show_university_on_home ?? false,
      social_hubs:
        (myProfile as any).socialHubs?.map((h: any) => ({
          id: h.id || h.place_id,
          name: h.name,
          category: h.category || "",
        })) ?? [],
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

  // --- Discover action bar logic ---
  const { handleLike, handleSkip, matchInfo, clearMatch } =
    useEncounterActions();

  // Build a minimal DiscoverEncounter for actions
  const encounterForActions: DiscoverEncounter | null = useMemo(() => {
    if (!isFromDiscover || !profileCardData) return null;
    return {
      user_a_id: "",
      user_b_id: "",
      place_id: params.placeId ?? "",
      encounter_type:
        (params.encounterType as DiscoverEncounter["encounter_type"]) ??
        "direct_overlap",
      affinity_score: 0,
      last_encountered_at: new Date().toISOString(),
      metadata: {},
      shared_interests_count: 0,
      other_user_id: profileCardData.user_id,
      other_name: profileCardData.name,
      other_age: profileCardData.age ?? null,
      other_photos: profileCardData.photos,
      other_verification_status: profileCardData.verification_status ?? null,
      other_bio: null,
      place_name: null,
      additional_encounters: null,
    } satisfies DiscoverEncounter;
  }, [isFromDiscover, profileCardData, params.placeId, params.encounterType]);

  const onLikePress = useCallback(async () => {
    if (!encounterForActions) return;
    await handleLike(encounterForActions);
    // Close after handleLike completes — pendingMatchInfo is now set
    // so the Discover screen will show the match modal via consumePendingMatch()
    router.back();
  }, [encounterForActions, handleLike, router]);

  const onSkipPress = useCallback(() => {
    if (!encounterForActions) return;
    handleSkip(encounterForActions);
    router.back();
  }, [encounterForActions, handleSkip, router]);

  const handleMatchSendMessage = useCallback(() => {
    if (!matchInfo) return;
    clearMatch();
    router.replace({
      pathname: "/main/message",
      params: {
        otherUserId: matchInfo.userId,
        name: matchInfo.name,
        photoUrl: matchInfo.photoUrl ?? undefined,
      },
    });
  }, [matchInfo, clearMatch, router]);

  const actionBar =
    isFromDiscover && profileCardData && !isLoading ? (
      <View
        style={[
          styles.actionFooter,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
        ]}
      >
        <Pressable
          onPress={onSkipPress}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.skipBtn,
            {
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text
            style={[typography.body, { color: colors.text, fontWeight: "600" }]}
          >
            {t("screens.discover.skipLabel")}
          </Text>
        </Pressable>

        <Pressable
          onPress={onLikePress}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.likeBtn,
            {
              backgroundColor: colors.accent,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text
            style={[typography.body, { color: "#FFFFFF", fontWeight: "600" }]}
          >
            {t("screens.discover.likeLabel")}
          </Text>
        </Pressable>
      </View>
    ) : undefined;

  return (
    <BaseTemplateScreen
      contentContainerStyle={styles.container}
      isModal
      refreshing={isRefreshing}
      onRefresh={isScanningOther ? handleRefresh : undefined}
      BottomBar={actionBar}
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

      {/* Match modal */}
      <ItsMatchModal
        isOpen={!!matchInfo}
        onClose={() => {
          clearMatch();
          router.back();
        }}
        onSendMessage={handleMatchSendMessage}
        name={matchInfo?.name ?? ""}
        photoUrl={matchInfo?.photoUrl ?? null}
      />
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
  actionFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  actionBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  skipBtn: {
    borderWidth: 1.5,
  },
  likeBtn: {},
});
