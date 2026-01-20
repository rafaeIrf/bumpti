import { NavigationIcon, StarIcon } from "@/assets/icons";
import { ConfirmationModal } from "@/components/confirmation-modal";
import Button from "@/components/ui/button";
import { RemoteImage } from "@/components/ui/remote-image";
import { VerificationBadge } from "@/components/verification-badge";
import {
  EDUCATION_OPTIONS,
  INTENTION_OPTIONS,
  RELATIONSHIP_OPTIONS,
  SMOKING_OPTIONS,
  ZODIAC_OPTIONS,
} from "@/constants/profile-options";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useUserActions } from "@/hooks/use-user-actions";
import { t } from "@/modules/locales";
import { ActiveUserAtPlace } from "@/modules/presence/api";
import { supabase } from "@/modules/supabase/client";
import { prefetchImages } from "@/utils/image-prefetch";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Divider } from "./ui/divider";

export interface UserProfile {
  id: string;
  name: string;
  age: number;
  photos: string[];
  bio: string;
  isHereNow?: boolean;
  favoritePlaces?: string[];
  visitedPlacesCount?: Record<string, number>;
  lookingFor?: string;
  location?: string;
}

interface PlaceData {
  id: string;
  name: string;
}

interface UserProfileCardProps {
  readonly profile: ActiveUserAtPlace;
  readonly currentPlaceId?: string;
  readonly places?: Record<string, PlaceData>;
  onBlockSuccess?: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_PADDING = spacing.lg;
const IMAGE_WIDTH = SCREEN_WIDTH - CARD_PADDING * 2;
const IMAGE_HEIGHT = IMAGE_WIDTH * (4 / 3); // Aspect ratio 3:4

export function UserProfileCard({
  profile,
  currentPlaceId,
  onBlockSuccess,
}: UserProfileCardProps) {
  const colors = useThemeColors();
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  const {
    handleReport,
    handleBlock,
    confirmBlock,
    isBlocking,
    showBlockModal,
    setShowBlockModal,
  } = useUserActions({
    userId: profile.user_id,
    userName: profile.name ?? "",
    onBlockSuccess,
  });

  const isOwnProfile = currentUserId === profile.user_id;

  const professionText = [profile.job_title, profile.company_name]
    .filter(Boolean)
    .join(" • ");
  const heightText =
    typeof profile.height_cm === "number"
      ? `${profile.height_cm} cm`
      : undefined;
  const smokingLabel = React.useMemo(() => {
    if (!profile.smoking_habit) return null;
    const option = SMOKING_OPTIONS.find(
      (opt) => opt.id === profile.smoking_habit
    );
    return option ? t(option.labelKey) : profile.smoking_habit;
  }, [profile.smoking_habit]);
  const relationshipLabel = React.useMemo(() => {
    if (!profile.relationship_status) return null;
    const option = RELATIONSHIP_OPTIONS.find(
      (opt) => opt.id === profile.relationship_status
    );
    return option ? t(option.labelKey) : profile.relationship_status;
  }, [profile.relationship_status]);
  const educationLabel = React.useMemo(() => {
    if (!profile.education_level) return null;
    const option = EDUCATION_OPTIONS.find(
      (opt) => opt.id === profile.education_level
    );
    return option ? t(option.labelKey) : profile.education_level;
  }, [profile.education_level]);
  const zodiacLabel = useMemo(() => {
    if (!profile.zodiac_sign) return null;
    const option = ZODIAC_OPTIONS.find((opt) => opt.id === profile.zodiac_sign);
    return option ? t(option.labelKey) : profile.zodiac_sign;
  }, [profile.zodiac_sign]);
  const languageLabels =
    profile.languages && profile.languages.length > 0
      ? profile.languages.map((code) => {
          const key = `languages.${code}`;
          const translated = t(key);
          return translated && translated !== key ? translated : code;
        })
      : [];

  // Reset photo index when profile changes
  useEffect(() => {
    setCurrentPhotoIndex(0);
  }, [profile.user_id]);

  // Prefetch photos for smoother swaps
  useEffect(() => {
    if (profile.photos.length > 0) {
      prefetchImages(profile.photos);
    }
  }, [profile.photos]);

  const nextPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev + 1) % profile.photos.length);
  };

  const prevPhoto = () => {
    setCurrentPhotoIndex(
      (prev) => (prev - 1 + profile.photos.length) % profile.photos.length
    );
  };

  const getVisitCount = () => {
    if (!currentPlaceId || !profile.visited_places_count) return 0;
    return profile.visited_places_count || 0;
  };

  const isFavoritePlace = () => {
    if (!currentPlaceId || !profile.favorite_places) return false;
    return profile.favorite_places.some((place) => {
      const placeId = typeof place === "string" ? place : place.id;
      return placeId === currentPlaceId;
    });
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.background,
          borderColor: colors.border,
        },
      ]}
    >
      {/* Photo carousel */}
      <View style={styles.carouselContainer}>
        <Animated.View
          key={currentPhotoIndex}
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={styles.imageContainer}
        >
          <RemoteImage
            source={{ uri: profile.photos[currentPhotoIndex] }}
            style={styles.image}
            contentFit="cover"
          />
        </Animated.View>

        {/* Photo navigation - invisible pressable areas */}
        {profile.photos.length > 1 && (
          <>
            <Pressable
              onPress={prevPhoto}
              style={styles.navAreaLeft}
              hitSlop={8}
            />
            <Pressable
              onPress={nextPhoto}
              style={styles.navAreaRight}
              hitSlop={8}
            />

            {/* Photo indicators */}
            <View style={styles.indicatorsContainer}>
              {profile.photos.map((photo, index) => (
                <View
                  key={`photo-${photo}-${index}`}
                  style={[
                    styles.indicator,
                    {
                      backgroundColor:
                        index === currentPhotoIndex
                          ? "#FFFFFF"
                          : "rgba(255, 255, 255, 0.3)",
                    },
                  ]}
                />
              ))}
            </View>
          </>
        )}

        {/* Overlay with gradient, name/age, badges */}
        <View style={styles.overlayContainer} pointerEvents="box-none">
          <LinearGradient
            colors={["transparent", colors.background]}
            locations={[0, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.overlayContent}>
            <View style={styles.nameAgeContainer}>
              <Text style={[styles.nameAge, { color: colors.text }]}>
                {profile.name}
                {profile.age ? `, ${profile.age}` : ""}
              </Text>
              <VerificationBadge
                verification_status={profile.verification_status}
                size={20}
              />
            </View>
            <View style={styles.badgesContainer}>
              {profile.entry_type && (
                <View
                  style={[
                    styles.hereNowBadge,
                    {
                      backgroundColor: colors.accent,
                    },
                  ]}
                >
                  <View style={styles.pulseIndicator} />
                  <Text style={[styles.hereNowText]}>
                    {profile.entry_type === "checkin_plus"
                      ? t("userProfile.planningToGo")
                      : t("userProfile.hereNow")}
                  </Text>
                </View>
              )}
              {isFavoritePlace() && (
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: "rgba(22, 24, 28, 0.9)",
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <StarIcon
                    width={14}
                    height={14}
                    color={colors.accent}
                    fill={colors.accent}
                  />
                  <Text style={[styles.badgeText, { color: colors.text }]}>
                    {t("userProfile.favorite")}
                  </Text>
                </View>
              )}

              {getVisitCount() > 0 && (
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: "rgba(22, 24, 28, 0.9)",
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <NavigationIcon
                    width={14}
                    height={14}
                    color={colors.accent}
                  />
                  <Text style={[styles.badgeText, { color: colors.text }]}>
                    {t("userProfile.visitCount", { count: getVisitCount() })}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Info section */}
      <View style={styles.infoSection}>
        {/* Bio */}
        {Boolean(profile.bio) && (
          <View style={styles.bioSection}>
            <Text style={[styles.bioText, { color: colors.text }]}>
              {profile.bio}
            </Text>
          </View>
        )}

        {/* Details */}
        {[
          { key: "work", value: professionText },
          { key: "location", value: profile.location },
          { key: "height", value: heightText },
          { key: "relationship", value: relationshipLabel },
          { key: "smoking", value: smokingLabel },
          { key: "education", value: educationLabel },
          { key: "zodiac", value: zodiacLabel },
        ].map(
          (item) =>
            item.value && (
              <View key={item.key} style={styles.detailBlock}>
                <Text
                  style={[styles.sectionTitle, { color: colors.textSecondary }]}
                >
                  {t(`userProfile.${item.key}`).toUpperCase()}
                </Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {item.value}
                </Text>
              </View>
            )
        )}
        {languageLabels.length > 0 && (
          <View style={styles.detailBlock}>
            <Text
              style={[styles.sectionTitle, { color: colors.textSecondary }]}
            >
              {t("userProfile.languages").toUpperCase()}
            </Text>
            <View style={styles.languagesContainer}>
              {languageLabels.map((label) => (
                <Button
                  key={label}
                  variant="outline"
                  size="sm"
                  label={label}
                  style={styles.languageChip}
                />
              ))}
            </View>
          </View>
        )}

        {/* Looking for */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {t("userProfile.interest")}
          </Text>
          <View style={styles.intentionsContainer}>
            {profile.intentions?.map((intention) => {
              const intentionId = String(intention);
              const option = INTENTION_OPTIONS.find(
                (opt) => opt.id === intentionId
              );
              const label = option ? t(option.labelKey) : intentionId;

              return (
                <Button
                  key={String(intention)}
                  variant="outline"
                  size="sm"
                  label={label}
                  style={styles.intentButton}
                />
              );
            })}
          </View>
        </View>

        {/* Favorite places */}
        {profile.favorite_places && profile.favorite_places.length > 0 && (
          <View style={styles.section}>
            <Text
              style={[styles.sectionTitle, { color: colors.textSecondary }]}
            >
              {t("userProfile.favoritePlaces")}
            </Text>
            <View style={styles.placesContainer}>
              {profile.favorite_places.map((place) => {
                const placeId = typeof place === "string" ? place : place.id;
                const placeName =
                  typeof place === "string" ? placeId : place.name || placeId;

                const label = `${placeName || placeId}`;

                return (
                  <Button
                    key={placeId}
                    variant="outline"
                    size="sm"
                    label={label}
                    style={styles.placeButton}
                  />
                );
              })}
            </View>
          </View>
        )}
      </View>

      {/* Actions (Report / Block) - Only for other users */}
      {!isOwnProfile && (
        <View style={styles.actionsSection}>
          <Divider />
          <View style={styles.actionButtons}>
            <Button
              label={t("actions.report")}
              onPress={handleReport}
              variant="secondary"
              size="default"
              fullWidth
              // style={styles.actionButton}
              textStyle={{ color: colors.textSecondary }}
            />
            <Button
              label={t("actions.block")}
              onPress={handleBlock}
              variant="secondary"
              size="default"
              fullWidth
              style={styles.actionButton}
              textStyle={{ color: colors.error }}
            />
          </View>
        </View>
      )}

      <ConfirmationModal
        isOpen={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        title={t("modals.chatActions.blockTitle", { name: profile.name ?? "" })}
        description={t("modals.chatActions.blockDescription", {
          name: profile.name ?? "",
        })}
        actions={[
          {
            label: t("modals.chatActions.blockConfirm", {
              name: profile.name ?? "",
            }),
            onPress: confirmBlock,
            variant: "destructive",
            loading: isBlocking,
            disabled: isBlocking,
          },
          {
            label: t("common.cancel"),
            onPress: () => setShowBlockModal(false),
            variant: "outline",
            disabled: isBlocking,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
  },
  carouselContainer: {
    position: "relative",
    width: "100%",
    height: IMAGE_HEIGHT,
    backgroundColor: "#000000",
  },
  imageContainer: {
    width: "100%",
    height: "100%",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  navAreaLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "40%",
    zIndex: 10,
  },
  navAreaRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: "40%",
    zIndex: 10,
  },
  indicatorsContainer: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    gap: 6,
    zIndex: 5,
  },
  indicator: {
    height: 4,
    flex: 1,
    borderRadius: 2,
  },
  overlayContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    paddingTop: spacing.xl,
    gap: spacing.sm,
  },
  overlayContent: {
    gap: spacing.sm,
  },
  badgesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  hereNowBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 20,
    gap: spacing.xs,
  },
  pulseIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
  hereNowText: {
    ...typography.caption,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  infoSection: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  headerInfo: {
    gap: spacing.xs,
  },
  nameAgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  nameAge: {
    ...typography.heading,
    fontSize: 24,
    fontWeight: "600",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  locationText: {
    ...typography.body,
    fontSize: 14,
  },
  bioSection: {
    marginTop: spacing.xs,
  },
  bioText: {
    ...typography.body,
    lineHeight: 22,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.captionBold,
  },
  interestContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  intentionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  intentButton: {
    alignSelf: "flex-start",
  },
  placesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  languagesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  languageChip: {
    alignSelf: "flex-start",
  },
  placeButton: {
    alignSelf: "flex-start",
  },
  detailBlock: {
    gap: spacing.xs,
  },
  detailValue: {
    ...typography.body,
  },
  actionsSection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  actionButtons: {
    alignItems: "center",
    gap: spacing.sm,
  },
  actionButton: {
    paddingHorizontal: spacing.md,
  },
});
