import {
  BriefcaseIcon,
  CigarreteIcon,
  GlobeIcon,
  GraduationCapIcon,
  MapPinIcon,
  RulerIcon,
  SparklesIcon,
  StarIcon,
} from "@/assets/icons";
import { ConfirmationModal } from "@/components/confirmation-modal";
import { RemoteImage } from "@/components/ui/remote-image";
import { VerificationBadge } from "@/components/verification-badge";
import {
  EDUCATION_OPTIONS,
  INTENTION_OPTIONS,
  SMOKING_OPTIONS,
  ZODIAC_OPTIONS,
} from "@/constants/profile-options";
import { spacing, typography } from "@/constants/theme";
import { useProfile } from "@/hooks/use-profile";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useUserActions } from "@/hooks/use-user-actions";
import { getCurrentLanguage, t } from "@/modules/locales";
import { ActiveUserAtPlace } from "@/modules/presence/api";
import { supabase } from "@/modules/supabase/client";
import { prefetchImages } from "@/utils/image-prefetch";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

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
// Use nearly full screen width for "Hero" feel, slightly padded if needed or full width
const CARD_PADDING = 0;
const IMAGE_WIDTH = SCREEN_WIDTH;
const IMAGE_HEIGHT = IMAGE_WIDTH * 1.4; // Taller hero aspect ratio

export function UserProfileCard({
  profile,
  currentPlaceId,
  onBlockSuccess,
  places,
}: UserProfileCardProps) {
  const colors = useThemeColors();
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Fetch current user full profile for intersections
  const { profile: currentUserProfile } = useProfile({ enabled: true });

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

  // Helpers for labels
  const getOptionLabel = (options: any[], value: any) => {
    if (!value) return null;
    const option = options.find((opt) => opt.id === value);
    return option ? t(option.labelKey) : value;
  };

  const professionText = [profile.job_title, profile.company_name]
    .filter(Boolean)
    .join(" • ");

  const educationText = getOptionLabel(
    EDUCATION_OPTIONS,
    profile.education_level
  );
  const heightText =
    typeof profile.height_cm === "number"
      ? getCurrentLanguage() === "en" || getCurrentLanguage() === "en-US"
        ? `${Math.floor(profile.height_cm / 30.48)} ft ${Math.round(
            (profile.height_cm % 30.48) / 2.54
          )} pol.`
        : `${(profile.height_cm / 100).toFixed(2)}m`
      : null;
  const zodiacText = getOptionLabel(ZODIAC_OPTIONS, profile.zodiac_sign);
  const smokingText = getOptionLabel(SMOKING_OPTIONS, profile.smoking_habit);

  const hasBasicInfo =
    !!profile.location ||
    !!heightText ||
    (profile.languages && profile.languages.length > 0);
  const hasLifestyle = !!zodiacText || !!smokingText;

  // --- Logic for Common Connections ---
  const commonIntentions = useMemo(() => {
    // Defensive checks for types
    const myIntentions = currentUserProfile?.intentions as string[] | undefined;
    const theirIntentions = profile.intentions as string[] | undefined;

    if (!myIntentions || !theirIntentions) return [];

    // Ensure accurate string comparison
    return theirIntentions.filter((i) => myIntentions.includes(i));
  }, [currentUserProfile, profile.intentions]);

  const commonPlaces = useMemo(() => {
    // Logic to compare place IDs
    // profile.favorite_places can be strings or objects

    // FIX: currentUserProfile uses favoritePlaces (camelCase)
    const myPlaces =
      (currentUserProfile as any)?.favoritePlaces?.map((p: any) =>
        typeof p === "string" ? p : p.id
      ) ?? [];

    if (myPlaces.length === 0 || !profile.favorite_places) return [];

    return profile.favorite_places.filter((p) => {
      const pId = typeof p === "string" ? p : p.id;
      return myPlaces.includes(pId);
    });
  }, [currentUserProfile, profile.favorite_places]);

  // Check match (allow own profile to see matches for preview purposes)
  const isMatchIntention = (i: string) =>
    !isOwnProfile && commonIntentions.includes(i);

  const isMatchPlace = (pId: string) =>
    !isOwnProfile &&
    commonPlaces.some((cp) => (typeof cp === "string" ? cp : cp.id) === pId);

  // --- Photo Navigation ---
  useEffect(() => {
    setCurrentPhotoIndex(0);
  }, [profile.user_id]);

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

  // --- Render Helpers ---

  // Section Component
  const Section = ({
    title,
    children,
    style,
  }: {
    title: string;
    children: React.ReactNode;
    style?: any;
  }) => (
    <View style={[styles.sectionContainer, style]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );

  // Info Row Component (Label -> Icon + Value)
  const InfoRow = ({
    label,
    icon,
    value,
  }: {
    label: string;
    icon: React.ReactNode;
    value: string | null | undefined;
  }) => {
    if (!value) return null;
    return (
      <View style={styles.infoRowContainer}>
        <Text style={styles.infoLabel}>{label}</Text>
        <View style={styles.infoValueRow}>
          {icon}
          <Text style={styles.infoValueText}>{value}</Text>
        </View>
        <View style={styles.separator} />
      </View>
    );
  };

  const renderTag = (label: string, icon?: React.ReactNode, blue?: boolean) => (
    <View
      key={label}
      style={[
        styles.tag,
        {
          backgroundColor: blue
            ? "rgba(41, 151, 255, 0.15)"
            : "rgba(255, 255, 255, 0.1)",
        },
        blue && { borderColor: "rgba(41, 151, 255, 0.3)", borderWidth: 1 },
      ]}
    >
      {icon}
      <Text style={[styles.tagText, { color: blue ? "#2997FF" : "#E7E9EA" }]}>
        {label}
      </Text>
    </View>
  );

  return (
    <View style={[styles.card, { backgroundColor: "#000000" }]}>
      {/* --- HERO PHOTO SECTION --- */}
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

        {/* Indicators at TOP */}
        <View style={styles.indicatorsContainer}>
          {profile.photos.map((_, index) => (
            <View
              key={index}
              style={[
                styles.indicator,
                {
                  backgroundColor:
                    index === currentPhotoIndex
                      ? "#FFFFFF"
                      : "rgba(255, 255, 255, 0.4)",
                },
              ]}
            />
          ))}
        </View>

        {/* Navigation Areas */}
        {profile.photos.length > 1 && (
          <>
            <Pressable onPress={prevPhoto} style={styles.navAreaLeft} />
            <Pressable onPress={nextPhoto} style={styles.navAreaRight} />
          </>
        )}

        {/* Overlay with Name/Age - Internal Bottom */}
        <LinearGradient
          colors={[
            "transparent",
            "rgba(0,0,0,0.3)",
            "rgba(0,0,0,0.9)",
            "#000000",
          ]}
          locations={[0.4, 0.6, 0.9, 1]}
          style={styles.overlayGradient}
          pointerEvents="none"
        />

        <View style={styles.overlayContent} pointerEvents="none">
          <View style={styles.nameRow}>
            <Text style={styles.nameText}>
              {profile.name}
              <Text style={styles.ageText}> {profile.age}</Text>
            </Text>
            {/* Verification Badge - BLUE */}
            {profile.verification_status === "verified" && (
              <VerificationBadge
                verification_status={profile.verification_status}
                size={24}
                color="#2997FF"
              />
            )}
          </View>

          {/* Job & Education - In Overlay now */}
          {(professionText || educationText) && (
            <View style={styles.subtitleRow}>
              {!!professionText && (
                <View style={styles.subtitleItem}>
                  <BriefcaseIcon width={14} height={14} color="#E7E9EA" />
                  <Text style={styles.subtitleText} numberOfLines={1}>
                    {professionText}
                  </Text>
                </View>
              )}
              {!!educationText && (
                <View style={styles.subtitleItem}>
                  <GraduationCapIcon width={14} height={14} color="#E7E9EA" />
                  <Text style={styles.subtitleText} numberOfLines={1}>
                    {educationText}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Quick status/location */}
          <View style={styles.quickStatusRow}>
            {/* Contextual Tags */}
            {profile.entry_type === "checkin_plus"
              ? renderTag(
                  t("userProfile.planningToGo"),
                  <SparklesIcon width={12} height={12} color="#2997FF" />,
                  true
                )
              : // Assume here now if found in list
                profile.entry_type === "physical" &&
                renderTag(
                  t("userProfile.hereNow"),
                  <View style={styles.onlineDot} />,
                  true
                )}
          </View>
        </View>
      </View>

      {/* --- SCROLLABLE DETAILS CONTENT --- */}
      <View style={styles.contentBody}>
        {/* BIO */}
        {!!profile.bio && (
          <Section title={t("userProfile.sections.about")}>
            <Text style={styles.bioText}>{profile.bio}</Text>
          </Section>
        )}

        {/* INTERESTS */}
        {profile.intentions && profile.intentions.length > 0 && (
          <Section title={t("userProfile.sections.interests")}>
            <View style={styles.chipsWrap}>
              {profile.intentions.map((i) =>
                renderTag(
                  getOptionLabel(INTENTION_OPTIONS, i),
                  isMatchIntention(i) ? (
                    <SparklesIcon width={12} height={12} color="#2997FF" />
                  ) : null,
                  isMatchIntention(i) // Blue if match
                )
              )}

              {/* Show fallback if empty? No, checking length above */}
            </View>
          </Section>
        )}

        {/* BASIC INFO */}
        {hasBasicInfo && (
          <Section title={t("userProfile.sections.basicInfo")}>
            {/* Job/School moved to overlay, but we can repeat specialized details here if beneficial, or just keep secondary stats */}
            <InfoRow
              label={t("userProfile.location")}
              value={
                profile.location
                  ? t("userProfile.nearLocation", {
                      location: profile.location,
                    })
                  : null
              }
              icon={<MapPinIcon width={18} height={18} color="#8B98A5" />}
            />
            <InfoRow
              label={t("userProfile.height")}
              value={heightText}
              icon={<RulerIcon width={18} height={18} color="#8B98A5" />}
            />
            {/* Education hidden if covered in overlay or handled elsewhere */}
            <InfoRow
              label={t("userProfile.education")}
              value={!educationText ? profile.education_level : null}
              icon={
                <GraduationCapIcon width={18} height={18} color="#8B98A5" />
              }
            />
            <InfoRow
              label={t("userProfile.languages")}
              value={profile.languages
                ?.map((l) => t(`languages.${l}`))
                .join(", ")}
              icon={<GlobeIcon width={18} height={18} color="#8B98A5" />}
            />
          </Section>
        )}

        {/* LIFESTYLE */}
        {hasLifestyle && (
          <Section title={t("userProfile.sections.lifestyle")}>
            <InfoRow
              label={t("userProfile.zodiac")}
              value={zodiacText}
              icon={<SparklesIcon width={18} height={18} color="#8B98A5" />}
            />
            <InfoRow
              label={t("userProfile.smoking")}
              value={smokingText}
              icon={<CigarreteIcon width={18} height={18} color="#8B98A5" />}
            />
            {/* Work info is null/hidden currently */}
          </Section>
        )}

        {/* FAVORITE PLACES */}
        {profile.favorite_places && profile.favorite_places.length > 0 && (
          <Section title={t("userProfile.favoritePlaces")}>
            <View style={styles.chipsWrap}>
              {profile.favorite_places.map((place) => {
                const placeId = typeof place === "string" ? place : place.id;
                const placeName =
                  typeof place !== "string" && place.name
                    ? place.name
                    : (places?.[placeId]?.name ?? placeId);
                const isMatch = isMatchPlace(placeId);

                return renderTag(
                  placeName,
                  isMatch ? (
                    <StarIcon
                      width={12}
                      height={12}
                      fill="#2997FF"
                      color="#2997FF"
                    />
                  ) : (
                    <StarIcon
                      width={12}
                      height={12}
                      fill="#E7E9EA"
                      color="#E7E9EA"
                    />
                  ),
                  isMatch
                );
              })}
            </View>
          </Section>
        )}
      </View>

      {/* ACTIONS */}
      {!isOwnProfile && (
        <View style={styles.actionsSection}>
          <Pressable
            onPress={handleReport}
            style={({ pressed }) => [
              styles.actionButton,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={styles.actionText}>{t("actions.report")}</Text>
          </Pressable>
          <Pressable
            onPress={() => setShowBlockModal(true)}
            style={({ pressed }) => [
              styles.actionButton,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.actionText, { color: colors.error }]}>
              {t("actions.block")}
            </Text>
          </Pressable>
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
    flex: 1,
    overflow: "hidden",
    // No border radius effectively implies full screen modal style if placed in one,
    // or we can add it if it's a card in a stack.
    backgroundColor: "#000000",
  },
  carouselContainer: {
    width: "100%",
    height: IMAGE_HEIGHT,
    backgroundColor: "#16181C",
    position: "relative",
  },
  imageContainer: {
    ...StyleSheet.absoluteFillObject,
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
    width: "30%",
    zIndex: 10,
  },
  navAreaRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: "30%",
    zIndex: 10,
  },
  indicatorsContainer: {
    position: "absolute",
    top: 6, // Very close to top edge
    left: spacing.sm,
    right: spacing.sm,
    flexDirection: "row",
    gap: 4,
    zIndex: 20,
    height: 4,
  },
  indicator: {
    flex: 1,
    height: 2,
    borderRadius: 1,
  },
  overlayGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "45%", // Slightly taller for more text
  },
  overlayContent: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.md,
    gap: 6,
    zIndex: 15,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  nameText: {
    fontFamily: "Poppins-Bold",
    fontSize: 30, // Large Hero Text
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  ageText: {
    fontFamily: "Poppins-Regular",
    fontSize: 24,
    color: "#E7E9EA",
  },

  // New Styles for Overlay Job/School
  subtitleRow: {
    flexDirection: "column",
    gap: 2,
    marginTop: -2,
    marginBottom: 4,
  },
  subtitleItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  subtitleText: {
    ...typography.caption,
    fontSize: 14,
    color: "#E7E9EA",
    fontWeight: "500",
  },

  quickStatusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  locationTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    ...typography.caption,
    fontSize: 13,
    color: "#E7E9EA",
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2997FF",
  },

  // --- Content Body ---
  contentBody: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: 24, // Generous vertical gap between sections
  },
  sectionContainer: {
    gap: 12,
  },
  sectionTitle: {
    fontFamily: "Poppins-Bold",
    fontSize: 16,
    color: "#E7E9EA",
    marginBottom: 4,
  },
  bioText: {
    ...typography.body,
    fontSize: 15,
    color: "#B0B3B8",
    lineHeight: 22,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16181C", // Dark chip
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 6,
    borderWidth: 1,
    borderColor: "#2F3336",
  },
  chipText: {
    ...typography.captionBold,
    color: "#E7E9EA",
    fontSize: 13,
  },

  // Tag Style Refined (shared)
  tag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: "#2F3336",
  },
  tagText: {
    ...typography.captionBold,
    fontSize: 13,
  },

  // Info Rows
  infoRowContainer: {
    gap: 4,
    marginBottom: 8,
  },
  infoLabel: {
    ...typography.caption,
    color: "#8B98A5", // Gray label
    fontWeight: "600",
    fontSize: 13,
  },
  infoValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  infoValueText: {
    ...typography.body,
    color: "#FFFFFF",
    fontSize: 15,
  },
  separator: {
    height: 1,
    backgroundColor: "#2F3336",
    marginTop: 8,
    opacity: 0.5,
  },

  // Actions
  actionsSection: {
    padding: spacing.lg,
    alignItems: "center",
  },
  actionButton: {
    padding: 12,
  },
  actionText: {
    color: "#5B6671",
    fontWeight: "600",
  },
});
