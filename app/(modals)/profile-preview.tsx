import { XIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedView } from "@/components/themed-view";
import { UserProfileCard } from "@/components/user-profile-card";
import { spacing } from "@/constants/theme";
import { useProfile } from "@/hooks/use-profile";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { ActiveUserAtPlace } from "@/modules/presence/api";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { ActivityIndicator, View } from "react-native";

export default function ProfilePreviewModal() {
  const { profile, isLoading } = useProfile();
  const colors = useThemeColors();
  const router = useRouter();

  const profileCardData: ActiveUserAtPlace | null = useMemo(() => {
    if (!profile) return null;

    const photos =
      profile.photos?.map((p) => p.url).filter((url) => !!url) ?? [];

    const favoritePlacesIds =
      profile.favoritePlaces?.map((p: any) => ({
        id: p.id || p.place_id,
        name: p.name,
      })) ?? [];

    return {
      user_id: profile.id || "me",
      name: profile.name ?? "",
      age: profile.age ?? null,
      bio: profile.bio ?? null,
      intentions: (profile.intentions ?? []).map((intent) => String(intent)),
      photos,
      job_title: profile.job_title ?? null,
      company_name: profile.company_name ?? null,
      height_cm: profile.height_cm ?? null,
      location: profile.location ?? null,
      languages: profile.languages ?? [],
      relationship_key: profile.relationship_key ?? null,
      smoking_key: profile.smoking_key ?? null,
      education_key: profile.education_key ?? null,
      entered_at: "",
      expires_at: "",
      visitedPlacesCount: favoritePlacesIds.length,
      favoritePlaces: favoritePlacesIds,
    };
  }, [profile]);

  return (
    <BaseTemplateScreen
      contentContainerStyle={{ paddingHorizontal: 0 }}
      isModal
      TopHeader={
        <ScreenToolbar
          title={t("screens.profile.preview.title")}
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
        {isLoading || !profileCardData ? (
          <View style={{ alignItems: "center" }}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <UserProfileCard profile={profileCardData} />
        )}
      </ThemedView>
    </BaseTemplateScreen>
  );
}
