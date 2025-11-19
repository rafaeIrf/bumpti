import {
  ArrowLeftIcon,
  CheckIcon,
  EllipsisVerticalIcon,
  SparklesIcon,
  UsersIcon,
  XIcon,
} from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ProfileSwiper, ProfileSwiperRef } from "@/components/profile-swiper";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { SwipeActionButtons } from "@/components/swipe-action-buttons";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { UserProfile } from "@/components/user-profile-card";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

interface Place {
  id: string;
  name: string;
  type: "bar" | "pub" | "club" | "university";
  distance: string;
  activeUsers: number;
  address: string;
  image: string;
}

// TODO: Replace with real data from API
const mockProfiles: UserProfile[] = [
  {
    id: "1",
    name: "Sofia",
    age: 24,
    photos: [
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=600&fit=crop",
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=600&fit=crop",
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=600&fit=crop",
    ],
    bio: "Amo música ao vivo, bares tranquilos e boas conversas com amigos ✨",
    isHereNow: true,
    visitedPlacesCount: { "1": 5 },
    favoritePlaces: ["1", "2", "6"],
    lookingFor: "friends",
    location: "Vila Madalena",
  },
  {
    id: "2",
    name: "Lucas",
    age: 27,
    photos: [
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop",
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=600&fit=crop",
    ],
    bio: "Cerveja artesanal e boa conversa são minhas paixões 🍺",
    isHereNow: true,
    visitedPlacesCount: { "1": 1 },
    favoritePlaces: ["1"],
    lookingFor: "chat",
    location: "Pinheiros",
  },
  {
    id: "3",
    name: "Mariana",
    age: 22,
    photos: [
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=600&fit=crop",
      "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&h=600&fit=crop",
      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&h=600&fit=crop",
    ],
    bio: "Dancinha e diversão! Adoro conhecer gente nova 💃",
    isHereNow: true,
    visitedPlacesCount: { "1": 3 },
    favoritePlaces: ["1", "4"],
    lookingFor: "meetpeople",
    location: "Jardins",
  },
  {
    id: "4",
    name: "Pedro",
    age: 25,
    photos: [
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=600&fit=crop",
      "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=600&fit=crop",
    ],
    bio: "Sempre aberto a novas amizades e aventuras pela cidade",
    isHereNow: true,
    visitedPlacesCount: { "1": 0 },
    favoritePlaces: ["1"],
    lookingFor: "friends",
    location: "Moema",
  },
  {
    id: "5",
    name: "Ana",
    age: 26,
    photos: [
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=600&fit=crop",
    ],
    bio: "Amo esse lugar! Frequento desde que me mudei pra SP",
    isHereNow: true,
    visitedPlacesCount: { "1": 8 },
    favoritePlaces: ["1", "2"],
    lookingFor: "chat",
    location: "Perdizes",
  },
];

const mockPlaces = {
  "1": { name: "Bar do João", emoji: "🍸" },
  "2": { name: "The Irish Pub", emoji: "🍺" },
  "6": { name: "Café Central", emoji: "☕" },
  "4": { name: "Universidade Central", emoji: "🎓" },
};

export default function PlacePeopleScreen() {
  const colors = useThemeColors();
  const swiperRef = useRef<ProfileSwiperRef>(null);
  const [hasProfiles, setHasProfiles] = useState(true);
  const [swipeX, setSwipeX] = useState<any>(null);
  const params = useLocalSearchParams<{
    placeId: string;
    placeName: string;
    distance?: string;
  }>();

  // TODO: Get from API/state
  const isUserHere = true;
  const isPremium = false;

  // TODO: Replace with real place data
  const place: Place = {
    id: params.placeId || "1",
    name: params.placeName || "Bar do João",
    type: "bar",
    distance: params.distance || "0.5 km",
    activeUsers: 12,
    address: "Rua Example, 123",
    image: "",
  };

  // Filter profiles based on whether user is at the place
  const availableProfiles = isUserHere
    ? mockProfiles.filter((p) => p.isHereNow)
    : mockProfiles.filter(
        (p) => p.isHereNow || p.favoritePlaces?.includes(place.id)
      );

  const handleLike = (profile: UserProfile) => {
    console.log("Liked profile:", profile.name);
    // TODO: Implement like logic
  };

  const handlePass = (profile: UserProfile) => {
    console.log("Passed profile:", profile.name);
    // TODO: Implement pass logic
  };

  const handleComplete = () => {
    console.log("No more profiles");
    setHasProfiles(false);
  };

  const handleUpgradeToPremium = () => {
    console.log("Navigate to premium subscription");
    // TODO: Navigate to premium screen
  };

  const handleBack = () => {
    router.back();
  };

  // Get swipeX from ref after mount
  useEffect(() => {
    if (swiperRef.current) {
      const sharedValue = swiperRef.current.getSwipeX();
      setSwipeX(sharedValue);
    }
  }, []);

  // Parse distance from string to number
  const distanceInKm = Number.parseFloat(place.distance.replace(" km", ""));
  const isFarAway = distanceInKm > 3;

  // Not at place AND far away (>3km) AND not premium - show premium upsell
  if (!isUserHere && isFarAway && !isPremium) {
    return (
      <BaseTemplateScreen
        isModal
        TopHeader={
          <ScreenToolbar
            leftAction={{
              icon: ArrowLeftIcon,
              onClick: handleBack,
              ariaLabel: t("common.back"),
              color: colors.icon,
            }}
            title={place.name}
          />
        }
      >
        <ThemedView style={styles.premiumContainer}>
          <View style={styles.premiumContent}>
            <LinearGradient
              colors={["#FFD700", "#FFA500"]}
              style={styles.premiumIcon}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <SparklesIcon width={40} height={40} color="#000000" />
            </LinearGradient>

            <ThemedText style={styles.premiumTitle}>
              {t("placePeople.premiumRequired")}
            </ThemedText>
            <ThemedText
              style={[
                styles.premiumDescription,
                { color: colors.textSecondary },
              ]}
            >
              {t("placePeople.premiumDescription")}
            </ThemedText>

            <View
              style={[
                styles.benefitsContainer,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.benefitRow}>
                <View
                  style={[styles.checkIcon, { backgroundColor: colors.accent }]}
                >
                  <CheckIcon width={16} height={16} color="#FFFFFF" />
                </View>
                <ThemedText style={styles.benefitText}>
                  {t("placePeople.benefit1")}
                </ThemedText>
              </View>

              <View style={styles.benefitRow}>
                <View
                  style={[styles.checkIcon, { backgroundColor: colors.accent }]}
                >
                  <CheckIcon width={16} height={16} color="#FFFFFF" />
                </View>
                <ThemedText style={styles.benefitText}>
                  {t("placePeople.benefit2")}
                </ThemedText>
              </View>

              <View style={styles.benefitRow}>
                <View
                  style={[styles.checkIcon, { backgroundColor: colors.accent }]}
                >
                  <CheckIcon width={16} height={16} color="#FFFFFF" />
                </View>
                <ThemedText style={styles.benefitText}>
                  {t("placePeople.benefit3")}
                </ThemedText>
              </View>
            </View>

            <View style={styles.premiumActions}>
              <LinearGradient
                colors={["#FFD700", "#FFA500"]}
                style={styles.premiumButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Button
                  onPress={handleUpgradeToPremium}
                  style={styles.premiumButton}
                  textStyle={styles.premiumButtonText}
                >
                  <SparklesIcon width={20} height={20} color="#000000" />
                  <ThemedText style={styles.premiumButtonTextContent}>
                    {t("placePeople.subscribePremium")}
                  </ThemedText>
                </Button>
              </LinearGradient>

              <Button onPress={handleBack} variant="secondary">
                {t("placePeople.backToPlaces")}
              </Button>
            </View>
          </View>
        </ThemedView>
      </BaseTemplateScreen>
    );
  }

  // No more profiles
  if (availableProfiles.length === 0) {
    return (
      <BaseTemplateScreen
        TopHeader={
          <ScreenToolbar
            leftAction={{
              icon: ArrowLeftIcon,
              onClick: handleBack,
              ariaLabel: t("common.back"),
              color: colors.icon,
            }}
            title={place.name}
          />
        }
      >
        <ThemedView style={styles.emptyContainer}>
          <View
            style={[
              styles.emptyIcon,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <UsersIcon width={48} height={48} color={colors.textSecondary} />
          </View>
          <ThemedText style={styles.emptyTitle}>
            {t("profileSwiper.emptyStateTitle")}
          </ThemedText>
          <ThemedText
            style={[styles.emptyDescription, { color: colors.textSecondary }]}
          >
            {t("profileSwiper.emptyStateDescription")}
          </ThemedText>
          <Button onPress={handleBack} style={styles.emptyButton}>
            {t("common.back")}
          </Button>
        </ThemedView>
      </BaseTemplateScreen>
    );
  }

  return (
    <View style={styles.screenContainer}>
      <BaseTemplateScreen
        isModal
        contentContainerStyle={{ paddingBottom: 156 }}
        TopHeader={
          <ScreenToolbar
            leftAction={{
              icon: XIcon,
              onClick: handleBack,
              ariaLabel: t("common.back"),
              color: colors.icon,
            }}
            title={place.name}
            rightActions={{
              icon: EllipsisVerticalIcon,
              onClick: () => console.log("Show info"),
              ariaLabel: t("placePeople.howItWorks"),
              color: colors.icon,
            }}
          />
        }
      >
        <ProfileSwiper
          ref={swiperRef}
          profiles={availableProfiles}
          currentPlaceId={place.id}
          places={mockPlaces}
          onLike={handleLike}
          onPass={handlePass}
          onComplete={handleComplete}
          emptyStateAction={{
            label: t("common.back"),
            onClick: handleBack,
          }}
        />
      </BaseTemplateScreen>

      {/* Action buttons - Fixed position outside BaseTemplateScreen */}
      {availableProfiles.length > 0 && hasProfiles && (
        <View style={styles.actionsContainer}>
          <SwipeActionButtons
            onLike={() => swiperRef.current?.handleLike()}
            onSkip={() => swiperRef.current?.handleSkip()}
            swipeX={swipeX}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
  },
  premiumContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  premiumContent: {
    alignItems: "center",
    maxWidth: 400,
    width: "100%",
  },
  premiumIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  premiumTitle: {
    ...typography.heading,
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  premiumDescription: {
    ...typography.body,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  benefitsContainer: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  checkIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  benefitText: {
    ...typography.body,
    flex: 1,
    fontSize: 14,
  },
  premiumActions: {
    width: "100%",
    gap: spacing.sm,
  },
  premiumButtonGradient: {
    borderRadius: 24,
  },
  premiumButton: {
    backgroundColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  premiumButtonText: {
    color: "#000000",
  },
  premiumButtonTextContent: {
    color: "#000000",
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.heading,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  emptyDescription: {
    ...typography.body,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  emptyButton: {
    marginTop: spacing.md,
  },
  actionsContainer: {
    position: "absolute",
    bottom: 56,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    zIndex: 10,
  },
});
