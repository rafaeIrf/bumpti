import { CheckIcon, SparklesIcon, UsersIcon, XIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ItsMatchModal } from "@/components/its-match-modal";
import { LoadingView } from "@/components/loading-view";
import { ProfileSwiper, ProfileSwiperRef } from "@/components/profile-swiper";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { SwipeActionButtons } from "@/components/swipe-action-buttons";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useDiscoveryFeed } from "@/hooks/use-discovery-feed";
import { useDiscoverySwipes } from "@/hooks/use-discovery-swipes";
import { usePrefetchWindowSize } from "@/hooks/use-prefetch-window-size";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { ActiveUserAtPlace } from "@/modules/presence/api";
import { upsertDiscoveryProfiles } from "@/modules/discovery/discovery-service";
import { useDatabase } from "@/components/DatabaseProvider";
import { prefetchNextCards } from "@/utils/image-prefetch";
import { logger } from "@/utils/logger";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
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

const mockPlaces = {
  "1": { name: "Bar do João", emoji: "🍸" },
  "2": { name: "The Irish Pub", emoji: "🍺" },
  "6": { name: "Café Central", emoji: "☕" },
  "4": { name: "Universidade Central", emoji: "🎓" },
};

export default function PlacePeopleScreen() {
  const colors = useThemeColors();
  const database = useDatabase();
  const prefetchWindowSize = usePrefetchWindowSize();
  const swiperRef = useRef<ProfileSwiperRef>(null);
  const [swipeX, setSwipeX] = useState<any>(null);
  const params = useLocalSearchParams<{
    placeId: string;
    placeName: string;
    distance?: string;
    distanceKm?: string;
    initialUsers?: string;
  }>();
  const [isHydratingInitialUsers, setIsHydratingInitialUsers] =
    useState(false);
  const [matchProfile, setMatchProfile] = useState<ActiveUserAtPlace | null>(
    null
  );
  const [deck, setDeck] = useState<ActiveUserAtPlace[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDeckExhausted, setIsDeckExhausted] = useState(false);
  const swipedIdsRef = useRef(new Set<string>());
  const deckIdsRef = useRef(new Set<string>());
  const [isRefilling, setIsRefilling] = useState(false);
  const lastRefillHadNewRef = useRef(false);
  const pendingRefillRef = useRef(false);
  const lastRefillIndexRef = useRef<number | null>(null);

  const placeId = params.placeId || "1";
  const hasInitialUsers = Boolean(params.initialUsers);

  const {
    profiles: availableProfiles,
    isLoading,
    refresh,
  } = useDiscoveryFeed(placeId, {
    enabled: !hasInitialUsers,
  });

  const profileByIdRef = useRef<Record<string, ActiveUserAtPlace>>({});
  const { queueSwipe } = useDiscoverySwipes(placeId, {
    onMatch: (targetUserId) => {
      const profile = profileByIdRef.current[targetUserId];
      if (profile) {
        setMatchProfile(profile);
      }
    },
  });

  useEffect(() => {
    setDeck([]);
    setCurrentIndex(0);
    setIsDeckExhausted(false);
    swipedIdsRef.current.clear();
    deckIdsRef.current.clear();
    lastRefillIndexRef.current = null;
  }, [placeId]);

  useEffect(() => {
    if (!params.initialUsers) return;
    let isMounted = true;

    const hydrateInitialUsers = async () => {
      setIsHydratingInitialUsers(true);
      try {
        const parsedUsers = JSON.parse(
          params.initialUsers
        ) as ActiveUserAtPlace[];
        await upsertDiscoveryProfiles({
          database,
          placeId,
          users: parsedUsers,
        });
      } catch (error) {
        logger.error("Failed to hydrate initial users", { error });
      } finally {
        if (isMounted) setIsHydratingInitialUsers(false);
      }
    };

    void hydrateInitialUsers();
    return () => {
      isMounted = false;
    };
  }, [database, params.initialUsers, placeId]);

  useEffect(() => {
    if (availableProfiles.length === 0) return;

    setDeck((prev) => {
      if (prev.length === 0) {
        const initial = availableProfiles.filter(
          (profile) => !swipedIdsRef.current.has(profile.user_id)
        );
        deckIdsRef.current = new Set(
          initial.map((profile) => profile.user_id)
        );
        setIsDeckExhausted(initial.length === 0);
        return initial;
      }

      const nextProfiles = availableProfiles.filter(
        (profile) =>
          !deckIdsRef.current.has(profile.user_id) &&
          !swipedIdsRef.current.has(profile.user_id)
      );
      if (nextProfiles.length === 0) return prev;

      nextProfiles.forEach((profile) => deckIdsRef.current.add(profile.user_id));
      if (pendingRefillRef.current) {
        lastRefillHadNewRef.current = true;
        lastRefillIndexRef.current = null;
      }
      setIsDeckExhausted(false);
      return [...prev, ...nextProfiles];
    });
  }, [availableProfiles]);

  useEffect(() => {
    const profileMap: Record<string, ActiveUserAtPlace> = {};
    deck.forEach((profile) => {
      profileMap[profile.user_id] = profile;
    });
    profileByIdRef.current = profileMap;
  }, [deck]);

  useEffect(() => {
    prefetchNextCards(deck, currentIndex, prefetchWindowSize);
  }, [currentIndex, deck, prefetchWindowSize]);

  // TODO: Get from API/state
  const isUserHere = true;
  const isPremium = false;

  // TODO: Replace with real place data
  const place: Place = {
    id: placeId,
    name: params.placeName || "Bar do João",
    type: "bar",
    distance: params.distance || "0.5 km",
    activeUsers: 12,
    address: "Rua Example, 123",
    image: "",
  };

  const handleLike = (profile: ActiveUserAtPlace) => {
    swipedIdsRef.current.add(profile.user_id);

    void (async () => {
      const { instantMatch } = await queueSwipe({
        targetUserId: profile.user_id,
        action: "like",
      });
      if (instantMatch) {
        setMatchProfile(profile);
      }
    })();
  };

  const handlePass = (profile: ActiveUserAtPlace) => {
    swipedIdsRef.current.add(profile.user_id);

    void queueSwipe({ targetUserId: profile.user_id, action: "dislike" });
  };

  const handleComplete = () => {
    logger.info("No more profiles");
  };

  const handleUpgradeToPremium = () => {
    logger.info("Navigate to premium subscription");
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
  const distanceInKm = params.distanceKm
    ? Number.parseFloat(params.distanceKm)
    : Number.parseFloat(place.distance.replace(" km", ""));
  const isFarAway = distanceInKm > 3;

  // No more profiles or Premium logic handled within unified return

  const toolbar = (
    <ScreenToolbar
      rightActions={[
        {
          icon: XIcon,
          onClick: handleBack,
          ariaLabel: t("common.back"),
          color: colors.icon,
        },
      ]}
      title={place.name}
    />
  );

  const loading = isLoading || isHydratingInitialUsers;
  const remaining = deck.length - currentIndex;
  const hasAvailableToAppend = useMemo(
    () =>
      availableProfiles.some(
        (profile) =>
          !deckIdsRef.current.has(profile.user_id) &&
          !swipedIdsRef.current.has(profile.user_id)
      ),
    [availableProfiles]
  );

  const showPremium = !isUserHere && isFarAway && !isPremium;
  const showEmpty =
    !loading &&
    !showPremium &&
    (deck.length === 0 || isDeckExhausted) &&
    !hasAvailableToAppend &&
    !isRefilling;
  const showSwiper =
    !loading && !showPremium && !showEmpty && remaining > 0;

  useEffect(() => {
    if (!showSwiper) return;
    if (remaining > 3) return;
    if (isRefilling) return;
    if (hasInitialUsers) return;
    if (lastRefillIndexRef.current === currentIndex) return;

    setIsRefilling(true);
    pendingRefillRef.current = true;
    lastRefillHadNewRef.current = false;
    lastRefillIndexRef.current = currentIndex;
    void refresh()
      .catch((error) => {
        logger.warn("Failed to refill discovery deck", { error });
      })
      .finally(() => {
        setIsRefilling(false);
        pendingRefillRef.current = false;
      });
  }, [hasInitialUsers, isRefilling, refresh, remaining, showSwiper]);

  useEffect(() => {
    if (isRefilling) return;
    if (remaining > 0) return;
    if (hasAvailableToAppend) return;
    if (pendingRefillRef.current) return;
    if (lastRefillHadNewRef.current) return;
    setIsDeckExhausted(true);
  }, [hasAvailableToAppend, isRefilling, remaining]);

  return (
    <View style={styles.screenContainer}>
      <ItsMatchModal
        isOpen={Boolean(matchProfile)}
        onClose={() => setMatchProfile(null)}
        name={matchProfile?.name ?? ""}
        photoUrl={matchProfile?.photos?.[0]}
      />
      <BaseTemplateScreen
        isModal
        contentContainerStyle={
          showSwiper ? { paddingBottom: 156, paddingHorizontal: 0 } : undefined
        }
        TopHeader={toolbar}
      >
        {loading && <LoadingView />}

        {showPremium && (
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
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.benefitRow}>
                  <View
                    style={[
                      styles.checkIcon,
                      { backgroundColor: colors.accent },
                    ]}
                  >
                    <CheckIcon width={16} height={16} color="#FFFFFF" />
                  </View>
                  <ThemedText style={styles.benefitText}>
                    {t("placePeople.benefit1")}
                  </ThemedText>
                </View>

                <View style={styles.benefitRow}>
                  <View
                    style={[
                      styles.checkIcon,
                      { backgroundColor: colors.accent },
                    ]}
                  >
                    <CheckIcon width={16} height={16} color="#FFFFFF" />
                  </View>
                  <ThemedText style={styles.benefitText}>
                    {t("placePeople.benefit2")}
                  </ThemedText>
                </View>

                <View style={styles.benefitRow}>
                  <View
                    style={[
                      styles.checkIcon,
                      { backgroundColor: colors.accent },
                    ]}
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
        )}

        {showEmpty && (
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
              {t("placePeople.emptyState.title")}
            </ThemedText>
            <ThemedText
              style={[styles.emptyDescription, { color: colors.textSecondary }]}
            >
              {t("placePeople.emptyState.description")}
            </ThemedText>
            <Button onPress={handleBack} style={styles.emptyButton}>
              {t("common.back")}
            </Button>
          </ThemedView>
        )}

        {showSwiper && (
          <ProfileSwiper
            ref={swiperRef}
            profiles={deck}
            currentPlaceId={place.id}
            places={mockPlaces}
            onLike={handleLike}
            onPass={handlePass}
            onComplete={handleComplete}
            onIndexChange={setCurrentIndex}
            emptyStateAction={{
              label: t("common.back"),
              onClick: handleBack,
            }}
          />
        )}
      </BaseTemplateScreen>

      {showSwiper && remaining > 0 && (
        <View style={styles.actionsContainer}>
          <SwipeActionButtons
            onLike={() => swiperRef.current?.handleLike()}
            onSkip={() => swiperRef.current?.handleDislike()}
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
