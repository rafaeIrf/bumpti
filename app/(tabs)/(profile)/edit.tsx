import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CoffeeIcon,
  FlagIcon,
  GraduationCapIcon,
  HeartIcon,
  MapIcon,
  MapPinIcon,
  ShoppingBagIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  UserRoundIcon,
} from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { UserPhotoGrid } from "@/components/user-photo-grid";
import {
  EDUCATION_OPTIONS,
  GENDER_OPTIONS,
  RELATIONSHIP_OPTIONS,
  SMOKING_OPTIONS,
  ZODIAC_OPTIONS,
} from "@/constants/profile-options";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { updateProfilePhotos } from "@/modules/profile/api";
import { useAppDispatch, useAppSelector } from "@/modules/store/hooks";
import { setProfile } from "@/modules/store/slices/profileSlice";
import { logger } from "@/utils/logger";
import { useRouter } from "expo-router";
import React from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SvgProps } from "react-native-svg";

type FieldType =
  | "bio"
  | "connectWith"
  | "lookingFor"
  | "spots"
  | "profession"
  | "height"
  | "education"
  | "location"
  | "languages"
  | "zodiac"
  | "smoking"
  | "gender"
  | "relationshipStatus";

interface EditRowProps {
  icon: React.ComponentType<SvgProps> | React.ComponentType<any>;
  label: string;
  value: string;
  onPress: () => void;
  iconType?: "svg" | "vector";
}

function EditRow({
  icon: Icon,
  label,
  value,
  onPress,
  iconType = "svg",
}: EditRowProps) {
  const colors = useThemeColors();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.surface,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={styles.rowLeft}>
        {iconType === "svg" ? (
          <Icon width={20} height={20} color={colors.textSecondary} />
        ) : (
          <Icon size={20} color={colors.textSecondary} />
        )}
        <View style={styles.rowText}>
          {value ? (
            <>
              <ThemedText
                style={[typography.caption, { color: colors.textSecondary }]}
              >
                {label}
              </ThemedText>
              <ThemedText
                style={[typography.body, { color: colors.text }]}
                numberOfLines={1}
              >
                {value}
              </ThemedText>
            </>
          ) : (
            <ThemedText
              style={[typography.body, { color: colors.text }]}
              numberOfLines={1}
            >
              {label}
            </ThemedText>
          )}
        </View>
      </View>
      <ArrowRightIcon width={20} height={20} color={colors.textSecondary} />
    </Pressable>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle: string;
}

function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  const colors = useThemeColors();
  return (
    <View style={styles.sectionHeader}>
      <ThemedText style={[typography.subheading, { color: colors.text }]}>
        {title}
      </ThemedText>
      <ThemedText style={[typography.body, { color: colors.textSecondary }]}>
        {subtitle}
      </ThemedText>
    </View>
  );
}

export default function ProfileEditScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const dispatch = useAppDispatch();
  const profile = useAppSelector((state) => state.profile.data);
  const [isUploading, setIsUploading] = React.useState(false);

  const photos = profile?.photos?.map((p) => p.url) || [];
  const photosRef = React.useRef(photos);
  photosRef.current = photos;
  const professionValue = React.useMemo(() => {
    const parts = [profile?.job_title, profile?.company_name].filter(
      Boolean
    ) as string[];
    return parts.join(" - ");
  }, [profile?.job_title, profile?.company_name]);
  const languageNames = React.useMemo(() => {
    if (!profile?.languages) return "";
    const translateLanguage = (code: string) => {
      const key = `languages.${code}`;
      const translated = t(key);
      return translated && translated !== key ? translated : code;
    };
    return profile.languages
      .map((id) => translateLanguage(id))
      .filter(Boolean)
      .join(", ");
  }, [profile?.languages]);

  const handlePhotosChange = async (newPhotos: string[]) => {
    if (!profile) return;

    const isAddition = newPhotos.length > photosRef.current.length;

    if (isAddition) {
      setIsUploading(true);
      // For additions, we DON'T do optimistic update to avoid flickering
      // when switching from local URI to remote URL.
      // Instead we show a loading state in the grid.
    } else {
      // For reordering or removal, we do optimistic update immediately
      const optimisticPhotos = newPhotos.map((url, index) => ({
        url,
        position: index,
      }));
      dispatch(setProfile({ ...profile, photos: optimisticPhotos }));
    }

    try {
      const updatedProfile = await updateProfilePhotos(newPhotos);
      if (updatedProfile?.photos) {
        // 3. Merge to preserve stable URLs and prevent flickering
        // We use the backend response for IDs and structure, but prefer the
        // current URLs (newPhotos) if the base path matches, to avoid
        // changing the 'key' in the list which causes blinking.
        const returnedPhotos = updatedProfile.photos;
        const mergedPhotos = returnedPhotos.map((photo, index) => {
          const currentUrl = newPhotos[index];
          // If we have a current URL and it matches the base of the returned one
          if (
            currentUrl &&
            currentUrl.split("?")[0] === photo.url.split("?")[0]
          ) {
            return { ...photo, url: currentUrl };
          }
          // Otherwise use the returned one (e.g. it was a local URI and now is remote)
          return photo;
        });

        dispatch(setProfile({ ...updatedProfile, photos: mergedPhotos }));
      }
    } catch (error) {
      logger.error("Failed to update photos:", error);
      Alert.alert(t("common.error"), t("errors.generic"));
      // Revert optimistic update if needed (by fetching profile again or undoing)
    } finally {
      setIsUploading(false);
    }
  };

  const handleFieldPress = (field: FieldType) => {
    if (field === "spots") {
      router.push("/(tabs)/(profile)/edit/favorite-places");
      return;
    }
    router.push({
      pathname: "/(tabs)/(profile)/edit/[field]",
      params: { field },
    });
  };

  const getTranslatedValue = (
    field: FieldType,
    value: string | null | undefined
  ) => {
    if (!value) return "";

    switch (field) {
      case "gender":
        return (
          t(
            GENDER_OPTIONS.find((o) => o.id === value)?.labelKey ||
              `screens.profile.options.gender.${value}`
          ) || value
        );
      case "relationshipStatus":
        return (
          t(
            RELATIONSHIP_OPTIONS.find((o) => o.id === value)?.labelKey ||
              `screens.profile.options.relationship.${value}`
          ) || value
        );
      case "smoking":
        return (
          t(
            SMOKING_OPTIONS.find((o) => o.id === value)?.labelKey ||
              `screens.profile.options.smoking.${value}`
          ) || value
        );
      case "education":
        return (
          t(
            EDUCATION_OPTIONS.find((o) => o.id === value)?.labelKey ||
              `screens.profile.options.education.${value}`
          ) || value
        );
      case "zodiac":
        return (
          t(
            ZODIAC_OPTIONS.find((o) => o.id === value)?.labelKey ||
              `screens.profile.options.zodiac.${value}`
          ) || value
        );
      default:
        return value;
    }
  };

  return (
    <BaseTemplateScreen
      TopHeader={
        <ScreenToolbar
          title={t("screens.profile.profileEdit.title")}
          leftAction={{
            icon: ArrowLeftIcon,
            onClick: () => router.back(),
            ariaLabel: t("common.back"),
          }}
        />
      }
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* Photos Section */}
        <View style={styles.section}>
          <SectionHeader
            title={t("screens.profile.profileEdit.photos.title")}
            subtitle={t("screens.profile.profileEdit.photos.subtitle")}
          />
          <UserPhotoGrid
            photos={photos}
            onPhotosChange={handlePhotosChange}
            maxPhotos={9}
            minPhotos={2}
            isUploading={isUploading}
          />
        </View>

        {/* Profile Section */}
        <View style={styles.section}>
          <SectionHeader
            title={t("screens.profile.profileEdit.profile.title")}
            subtitle={t("screens.profile.profileEdit.profile.subtitle")}
          />
          <EditRow
            icon={SparklesIcon}
            label={t("screens.profile.profileEdit.profile.bio")}
            value={profile?.bio || ""}
            onPress={() => handleFieldPress("bio")}
          />
        </View>

        {/* Personal Info Section */}
        <View style={styles.section}>
          <SectionHeader
            title={t("screens.profile.profileEdit.personalInfo.title")}
            subtitle={t("screens.profile.profileEdit.personalInfo.subtitle")}
          />
          <EditRow
            icon={UserRoundIcon}
            label={t("screens.profile.profileEdit.personalInfo.gender")}
            value={getTranslatedValue("gender", profile?.gender)}
            onPress={() => handleFieldPress("gender")}
          />
          <EditRow
            icon={HeartIcon}
            label={t(
              "screens.profile.profileEdit.personalInfo.relationshipStatus"
            )}
            value={getTranslatedValue(
              "relationshipStatus",
              profile?.relationship_key
            )}
            onPress={() => handleFieldPress("relationshipStatus")}
          />
          <EditRow
            icon={SlidersHorizontalIcon}
            label={t("screens.profile.profileEdit.personalInfo.height")}
            value={profile?.height_cm ? `${profile.height_cm} cm` : ""}
            onPress={() => handleFieldPress("height")}
          />
        </View>

        {/* Lifestyle Section */}
        <View style={styles.section}>
          <SectionHeader
            title={t("screens.profile.profileEdit.lifestyle.title")}
            subtitle={t("screens.profile.profileEdit.lifestyle.subtitle")}
          />
          <EditRow
            icon={ShoppingBagIcon}
            label={t("screens.profile.profileEdit.lifestyle.profession")}
            value={professionValue}
            onPress={() => handleFieldPress("profession")}
          />
          <EditRow
            icon={CoffeeIcon}
            label={t("screens.profile.profileEdit.lifestyle.smoking")}
            value={getTranslatedValue("smoking", profile?.smoking_key)}
            onPress={() => handleFieldPress("smoking")}
          />
        </View>

        {/* Interests Section */}
        <View style={styles.section}>
          <SectionHeader
            title={t("screens.profile.profileEdit.interests.title")}
            subtitle={t("screens.profile.profileEdit.interests.subtitle")}
          />
          <EditRow
            icon={MapIcon}
            label={t("screens.profile.profileEdit.interests.spots")}
            value={
              profile?.favoritePlaces && profile.favoritePlaces.length > 0
                ? `${profile.favoritePlaces.length} spots`
                : ""
            }
            onPress={() => handleFieldPress("spots")}
          />
        </View>

        {/* More Section */}
        <View style={styles.section}>
          <SectionHeader
            title={t("screens.profile.profileEdit.more.title")}
            subtitle={t("screens.profile.profileEdit.more.subtitle")}
          />
          <EditRow
            icon={GraduationCapIcon}
            label={t("screens.profile.profileEdit.more.education")}
            value={getTranslatedValue("education", profile?.education_key)}
            onPress={() => handleFieldPress("education")}
          />
          <EditRow
            icon={MapPinIcon}
            label={t("screens.profile.profileEdit.more.location")}
            value={profile?.location || ""}
            onPress={() => handleFieldPress("location")}
          />
          <EditRow
            icon={FlagIcon}
            label={t("screens.profile.profileEdit.more.languages")}
            value={languageNames}
            onPress={() => handleFieldPress("languages")}
          />
          <EditRow
            icon={SparklesIcon}
            label={t("screens.profile.profileEdit.more.zodiac")}
            value={getTranslatedValue("zodiac", profile?.zodiac_key)}
            onPress={() => handleFieldPress("zodiac")}
          />
        </View>
      </ScrollView>
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: spacing.md,
    paddingBottom: spacing.xxl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderRadius: 16,
    marginBottom: spacing.sm,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  rowText: {
    flex: 1,
  },
});
