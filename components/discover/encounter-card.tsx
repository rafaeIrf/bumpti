import { RemoteImage } from "@/components/ui/remote-image";
import { VerificationBadge } from "@/components/verification-badge";
import { spacing, typography } from "@/constants/theme";
import { useHydratedProfile } from "@/hooks/use-hydrated-profile";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { DiscoverEncounter } from "@/modules/discover/types";
import { useUserSubscription } from "@/modules/iap/hooks";
import { t } from "@/modules/locales";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Card dimensions
export const LARGE_CARD_WIDTH = SCREEN_WIDTH * 0.72;
export const LARGE_CARD_HEIGHT = LARGE_CARD_WIDTH * (4 / 3);
export const MEDIUM_CARD_WIDTH = SCREEN_WIDTH * 0.52;
export const MEDIUM_CARD_HEIGHT = MEDIUM_CARD_WIDTH * (4 / 3);
export const CARD_SPACING = spacing.sm;

type EncounterCardProps = {
  encounter: DiscoverEncounter;
  variant: "large" | "medium";
  index: number;
};

export default function EncounterCard({
  encounter,
  variant,
  index,
}: EncounterCardProps) {
  const colors = useThemeColors();
  const router = useRouter();
  const { isPremium } = useUserSubscription();
  const { profile, isLoading } = useHydratedProfile(encounter.other_user_id);

  const cardWidth = variant === "large" ? LARGE_CARD_WIDTH : MEDIUM_CARD_WIDTH;
  const cardHeight =
    variant === "large" ? LARGE_CARD_HEIGHT : MEDIUM_CARD_HEIGHT;

  // Use data from hydrated profile or encounter fallback
  const name = profile?.name ?? encounter.other_name;
  const age = profile?.age ?? encounter.other_age;
  const photos = profile?.photos ?? encounter.other_photos ?? [];
  const verificationStatus =
    profile?.verification_status ?? encounter.other_verification_status;
  const interests = profile?.interests ?? [];

  const firstPhoto = photos[0];

  const contextLabel = useMemo(() => {
    if (encounter.encounter_type === "direct_overlap") {
      return encounter.place_name
        ? t("screens.discover.contextOverlap", {
            place: encounter.place_name,
          })
        : t("screens.discover.contextOverlapGeneric");
    }
    if (encounter.encounter_type === "vibe_match") {
      const count = encounter.shared_interests_count ?? 0;
      return t("screens.discover.contextVibe", { count: String(count) });
    }
    return encounter.place_name
      ? t("screens.discover.contextRoutine", {
          place: encounter.place_name,
        })
      : t("screens.discover.contextRoutineGeneric");
  }, [encounter]);

  const handlePress = () => {
    if (!isPremium) {
      router.push("/(modals)/premium-paywall");
      return;
    }
    router.push({
      pathname: "/(modals)/profile-preview",
      params: { userId: encounter.other_user_id },
    });
  };

  // Skeleton while loading
  if (isLoading && !name) {
    return (
      <View
        style={[
          styles.card,
          {
            width: cardWidth,
            height: cardHeight,
            backgroundColor: colors.surface,
            borderRadius: 20,
          },
        ]}
      />
    );
  }

  return (
    <Animated.View
      entering={FadeIn.delay(index * 80).duration(400)}
      style={[styles.card, { width: cardWidth }]}
    >
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.pressable,
          { opacity: pressed ? 0.92 : 1 },
        ]}
      >
        {/* Photo */}
        <View
          style={[
            styles.imageContainer,
            {
              width: cardWidth,
              height: cardHeight,
              borderRadius: 20,
              overflow: "hidden",
              backgroundColor: colors.surface,
            },
          ]}
        >
          {firstPhoto ? (
            <RemoteImage
              source={{ uri: firstPhoto }}
              style={[StyleSheet.absoluteFill]}
              blurRadius={isPremium ? 0 : 80}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.surface },
              ]}
            />
          )}

          {/* Gradient overlay for text */}
          <View style={styles.gradientOverlay} />

          {/* Blur CTA for Free users */}
          {!isPremium && (
            <View style={styles.blurCtaContainer}>
              <View style={styles.blurCtaPill}>
                <Text
                  style={[
                    typography.caption,
                    styles.blurCta,
                    { color: "#FFFFFF" },
                  ]}
                >
                  {t("screens.discover.blurCta")}
                </Text>
              </View>
            </View>
          )}

          {/* Bottom info */}
          <View style={styles.infoContainer}>
            {/* Name + Age + Verified */}
            <View style={styles.nameRow}>
              <Text
                style={[typography.subheading, { color: "#FFFFFF" }]}
                numberOfLines={1}
              >
                {name}
                {age ? `, ${age}` : ""}
              </Text>
              {verificationStatus === "verified" && (
                <VerificationBadge
                  verification_status="verified"
                  size={18}
                  color="#FFFFFF"
                  style={styles.badge}
                />
              )}
            </View>

            {/* Context label */}
            <Text
              style={[typography.caption, { color: "rgba(255,255,255,0.75)" }]}
              numberOfLines={1}
            >
              {contextLabel}
            </Text>

            {/* Interest pills (vibe_match only) */}
            {encounter.encounter_type === "vibe_match" &&
              interests.length > 0 && (
                <View style={styles.interestsRow}>
                  {interests.slice(0, 3).map((interest) => (
                    <View
                      key={interest}
                      style={[
                        styles.interestPill,
                        { backgroundColor: "rgba(255,255,255,0.15)" },
                      ]}
                    >
                      <Text style={[typography.caption, { color: "#FFFFFF" }]}>
                        {interest}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginRight: CARD_SPACING,
  },
  pressable: {
    borderRadius: 20,
  },
  imageContainer: {
    position: "relative",
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
  },
  infoContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  badge: {
    marginLeft: spacing.xs,
  },
  blurCtaContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  blurCta: {
    fontWeight: "600",
    textAlign: "center",
  },
  blurCtaPill: {
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
  },
  interestsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  interestPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 12,
  },
});
