import { NavigationIcon, StarIcon } from "@/assets/icons";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { ActiveUserAtPlace } from "@/modules/presence/api";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
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
  name: string;
  emoji: string;
}

interface UserProfileCardProps {
  readonly profile: ActiveUserAtPlace;
  readonly currentPlaceId?: string;
  readonly places?: Record<string, PlaceData>;
}

const DEFAULT_PLACES: Record<string, PlaceData> = {
  "1": { name: "Bar do João", emoji: "🍸" },
  "2": { name: "The Irish Pub", emoji: "🍺" },
  "6": { name: "Café Central", emoji: "☕" },
  "4": { name: "Universidade Central", emoji: "🎓" },
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_PADDING = spacing.lg;
const IMAGE_WIDTH = SCREEN_WIDTH - CARD_PADDING * 2;
const IMAGE_HEIGHT = IMAGE_WIDTH * (4 / 3); // Aspect ratio 3:4

export function UserProfileCard({
  profile,
  currentPlaceId,
  places = DEFAULT_PLACES,
}: UserProfileCardProps) {
  const colors = useThemeColors();
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  // Reset photo index when profile changes
  useEffect(() => {
    setCurrentPhotoIndex(0);
  }, [profile.user_id]);

  // Prefetch photos for smoother swaps
  useEffect(() => {
    profile.photos.forEach((uri) => {
      Image.prefetch?.(uri);
    });
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
    if (!currentPlaceId || !profile.visitedPlacesCount) return 0;
    return profile.visitedPlacesCount || 0;
  };

  const isFavoritePlace = () => {
    if (!currentPlaceId || !profile.favoritePlaces) return false;
    return profile.favoritePlaces.includes(currentPlaceId);
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
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
          <Image
            source={profile.photos[currentPhotoIndex]}
            style={styles.image}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={0}
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

        {/* Status badges */}
        <View style={styles.badgesContainer}>
          {/* {profile.isHereNow && (
            <View
              style={[styles.hereNowBadge, { backgroundColor: colors.accent }]}
            >
              <View style={styles.pulseIndicator} />
              <Text style={styles.hereNowText}>{t("userProfile.hereNow")}</Text>
            </View>
          )} */}

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
              <NavigationIcon width={14} height={14} color={colors.accent} />
              <Text style={[styles.badgeText, { color: colors.text }]}>
                {t("userProfile.visitCount", { count: getVisitCount() })}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Info section */}
      <View style={styles.infoSection}>
        {/* Name, age and location */}
        <View style={styles.headerInfo}>
          <Text style={[styles.nameAge, { color: colors.text }]}>
            {profile.name}, {profile.age}
          </Text>
          {/* {profile.location && (
            <View style={styles.locationRow}>
              <MapPinIcon width={16} height={16} color={colors.textSecondary} />
              <Text
                style={[styles.locationText, { color: colors.textSecondary }]}
              >
                {t("userProfile.nearLocation", { location: profile.location })}
              </Text>
            </View>
          )} */}
        </View>

        {/* Bio */}
        {Boolean(profile.bio) && (
          <View style={styles.bioSection}>
            <Text style={[styles.bioText, { color: colors.text }]}>
              {profile.bio}
            </Text>
          </View>
        )}

        {/* Looking for */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {t("userProfile.interest")}
          </Text>
          <View style={styles.interestContainer}>
            {profile.intentions?.map((intention) => (
              <View
                key={intention}
                style={[
                  styles.interestBadge,
                  {
                    backgroundColor: `${colors.accent}1A`,
                  },
                ]}
              >
                <Text style={[styles.interestText, { color: colors.accent }]}>
                  {t(`userProfile.lookingFor.${intention}`)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Favorite places */}
        {profile.favoritePlaces && profile.favoritePlaces.length > 0 && (
          <View style={styles.section}>
            <Text
              style={[styles.sectionTitle, { color: colors.textSecondary }]}
            >
              {t("userProfile.favoritePlaces")}
            </Text>
            <View style={styles.placesContainer}>
              {profile.favoritePlaces.map((placeId) => {
                const placeData = places[placeId];
                if (!placeData) return null;

                const isCurrentPlace = placeId === currentPlaceId;

                return (
                  <View
                    key={placeId}
                    style={[
                      styles.placeChip,
                      {
                        backgroundColor: isCurrentPlace
                          ? `${colors.accent}1A`
                          : "#000000",
                        borderColor: isCurrentPlace
                          ? colors.accent
                          : colors.border,
                      },
                    ]}
                  >
                    <Text style={styles.placeEmoji}>{placeData.emoji}</Text>
                    <Text style={[styles.placeName, { color: colors.text }]}>
                      {placeData.name}
                    </Text>
                    {isCurrentPlace && (
                      <StarIcon
                        width={12}
                        height={12}
                        color={colors.accent}
                        fill={colors.accent}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
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
  badgesContainer: {
    position: "absolute",
    bottom: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    zIndex: 5,
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
    ...typography.caption,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  interestContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  interestBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    gap: 6,
  },
  interestText: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: "500",
  },
  placesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  placeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    borderWidth: 1,
    gap: spacing.xs,
  },
  placeEmoji: {
    fontSize: 18,
  },
  placeName: {
    ...typography.body,
    fontSize: 14,
  },
});
