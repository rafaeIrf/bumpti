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
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { useAppDispatch, useAppSelector } from "@/modules/store/hooks";
import { setProfile } from "@/modules/store/slices/profileSlice";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SvgProps } from "react-native-svg";

type FieldType =
  | "bio"
  | "connectWith"
  | "lookingFor"
  | "spots"
  | "profession"
  | "height"
  | "education"
  | "hometown"
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
          <ThemedText
            style={[typography.caption, { color: colors.textSecondary }]}
          >
            {label}
          </ThemedText>
          <ThemedText
            style={[typography.body, { color: colors.text }]}
            numberOfLines={1}
          >
            {value || t("screens.profile.profileEdit.add")}
          </ThemedText>
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
      <ThemedText style={[typography.heading, { color: colors.text }]}>
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

  const photos = profile?.photos?.map((p) => p.url) || [];

  const handlePhotosChange = (newPhotos: string[]) => {
    if (profile) {
      const updatedPhotos = newPhotos.map((url, index) => ({
        url,
        position: index,
      }));
      dispatch(setProfile({ ...profile, photos: updatedPhotos }));
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
            value={profile?.gender || ""}
            onPress={() => handleFieldPress("gender")}
          />
          <EditRow
            icon={HeartIcon}
            label={t(
              "screens.profile.profileEdit.personalInfo.relationshipStatus"
            )}
            value={profile?.relationshipStatus || ""}
            onPress={() => handleFieldPress("relationshipStatus")}
          />
          <EditRow
            icon={SlidersHorizontalIcon}
            label={t("screens.profile.profileEdit.personalInfo.height")}
            value={profile?.height ? `${profile.height} cm` : ""}
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
            value={profile?.profession || ""}
            onPress={() => handleFieldPress("profession")}
          />
          <EditRow
            icon={CoffeeIcon}
            label={t("screens.profile.profileEdit.lifestyle.smoking")}
            value={profile?.smoking || ""}
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
            value={profile?.education || ""}
            onPress={() => handleFieldPress("education")}
          />
          <EditRow
            icon={MapPinIcon}
            label={t("screens.profile.profileEdit.more.hometown")}
            value={profile?.hometown || ""}
            onPress={() => handleFieldPress("hometown")}
          />
          <EditRow
            icon={FlagIcon}
            label={t("screens.profile.profileEdit.more.languages")}
            value={
              Array.isArray(profile?.languages)
                ? profile.languages.join(", ")
                : ""
            }
            onPress={() => handleFieldPress("languages")}
          />
          <EditRow
            icon={SparklesIcon}
            label={t("screens.profile.profileEdit.more.zodiac")}
            value={profile?.zodiac || ""}
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
