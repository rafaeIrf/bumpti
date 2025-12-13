import { XIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { UserProfileCard } from "@/components/user-profile-card";
import { spacing, typography } from "@/constants/theme";
import { useProfile } from "@/hooks/use-profile";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { ActiveUserAtPlace } from "@/modules/presence/api";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";

export default function ProfilePreviewModal() {
  const { profile: myProfile, isLoading: isMyProfileLoading } = useProfile();
  const colors = useThemeColors();
  const router = useRouter();
  const params = useLocalSearchParams<{
    userId?: string;
    initialProfile?: string;
  }>();

  const [otherUserProfile, setOtherUserProfile] =
    useState<ActiveUserAtPlace | null>(() => {
      if (params.initialProfile) {
        try {
          return JSON.parse(params.initialProfile);
        } catch (e) {
          console.warn("Failed to parse initial profile", e);
        }
      }
      return null;
    });

  const isScanningOther = !!params.userId;

  // Sync state if params change while mounted
  useEffect(() => {
    if (params.initialProfile) {
      try {
        const parsed = JSON.parse(params.initialProfile);
        // Only update if ID changed to avoid loops (though parsing creates new obj)
        // or just set it.
        setOtherUserProfile(parsed);
      } catch (e) {
        console.warn("Failed to parse initial profile update", e);
      }
    }
  }, [params.initialProfile]);

  const profileCardData: ActiveUserAtPlace | null = useMemo(() => {
    if (isScanningOther) {
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
      entered_at: "",
      expires_at: "",
      visited_places_count: favoritePlacesIds.length,
      favorite_places: favoritePlacesIds,
    };
  }, [isScanningOther, otherUserProfile, myProfile]);

  // If scanning other, we rely on immediate param data, so not "loading" in the async sense.
  // Unless we want to consider "parsing" as instant.
  const isLoading = isScanningOther ? false : isMyProfileLoading;

  return (
    <BaseTemplateScreen
      contentContainerStyle={{ paddingHorizontal: 0 }}
      isModal
      TopHeader={
        <ScreenToolbar
          title={otherUserProfile?.name || t("screens.profile.preview.title")}
          leftAction={{
            icon: XIcon,
            onClick: () => router.back(),
            ariaLabel: t("common.back"),
          }}
        />
      }
    >
      <ThemedView
        style={{
          flex: 1,
          paddingBottom: spacing.xl,
          justifyContent: "center",
        }}
      >
        {isLoading ? (
          <View style={{ alignItems: "center" }}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : !profileCardData ? (
          <View style={{ alignItems: "center", padding: spacing.lg }}>
            <ThemedText style={typography.body}>
              {t("errors.profileUnavailable")}
            </ThemedText>
          </View>
        ) : (
          <UserProfileCard profile={profileCardData} />
        )}
      </ThemedView>
    </BaseTemplateScreen>
  );
}
