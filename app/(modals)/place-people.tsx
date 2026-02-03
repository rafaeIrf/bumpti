import { UsersIcon, XIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { useDatabase } from "@/components/DatabaseProvider";
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
import { upsertDiscoveryProfiles } from "@/modules/discovery/discovery-service";
import { removeQueuedSwipes } from "@/modules/discovery/swipe-queue-service";
import { useUserSubscription } from "@/modules/iap/hooks";
import { t } from "@/modules/locales";
import { ActiveUserAtPlace } from "@/modules/presence/api";
import { prefetchNextCards } from "@/utils/image-prefetch";
import { logger } from "@/utils/logger";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

interface Place {
  id: string;
  name: string;
}

export default function PlacePeopleScreen() {
  const colors = useThemeColors();
  const database = useDatabase();
  const prefetchWindowSize = usePrefetchWindowSize();
  const swiperRef = useRef<ProfileSwiperRef>(null);
  const [swipeX, setSwipeX] = useState<any>(null);
  const params = useLocalSearchParams<{
    placeId: string;
    placeName: string;
    initialUsers?: string;
  }>();
  const [isHydratingInitialUsers, setIsHydratingInitialUsers] = useState(false);
  const [matchProfile, setMatchProfile] = useState<ActiveUserAtPlace | null>(
    null,
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
  const lastSwipeIdRef = useRef<string | null>(null);
  const [lastSwipedProfile, setLastSwipedProfile] =
    useState<ActiveUserAtPlace | null>(null);
  const [lastSwipeWasMatch, setLastSwipeWasMatch] = useState(false);
  const [rewindUsedForCurrent, setRewindUsedForCurrent] = useState(false);
  const { isPremium } = useUserSubscription();

  const placeId = params.placeId;
  const hasInitialUsers = Boolean(params.initialUsers);

  const place: Place = {
    id: placeId,
    name: params.placeName,
  };

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
      if (lastSwipeIdRef.current === targetUserId) {
        setLastSwipeWasMatch(true);
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
    lastSwipeIdRef.current = null;
    setLastSwipedProfile(null);
    setLastSwipeWasMatch(false);
    setRewindUsedForCurrent(false);
  }, [placeId]);

  useEffect(() => {
    if (!params.initialUsers) return;
    let isMounted = true;

    const hydrateInitialUsers = async () => {
      setIsHydratingInitialUsers(true);
      try {
        const parsedUsers = JSON.parse(
          params.initialUsers,
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
          (profile) => !swipedIdsRef.current.has(profile.user_id),
        );
        deckIdsRef.current = new Set(initial.map((profile) => profile.user_id));
        setIsDeckExhausted(initial.length === 0);
        return initial;
      }

      const nextProfiles = availableProfiles.filter(
        (profile) =>
          !deckIdsRef.current.has(profile.user_id) &&
          !swipedIdsRef.current.has(profile.user_id),
      );
      if (nextProfiles.length === 0) return prev;

      nextProfiles.forEach((profile) =>
        deckIdsRef.current.add(profile.user_id),
      );
      if (pendingRefillRef.current) {
        lastRefillHadNewRef.current = true;
        lastRefillIndexRef.current = null;
      }
      setIsDeckExhausted(false);
      return [...prev, ...nextProfiles];
    });
  }, [availableProfiles]);

  useEffect(() => {
    if (deck.length === 0) {
      if (currentIndex !== 0) setCurrentIndex(0);
      return;
    }
    if (currentIndex > deck.length) {
      setCurrentIndex(deck.length);
    }
  }, [currentIndex, deck.length]);

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

  const handleLike = (profile: ActiveUserAtPlace) => {
    swipedIdsRef.current.add(profile.user_id);
    lastSwipeIdRef.current = profile.user_id;
    setLastSwipedProfile(profile);
    setLastSwipeWasMatch(false);
    setRewindUsedForCurrent(false);

    void (async () => {
      const resolvedPlaceId = profile.place_id ?? placeId;
      if (!resolvedPlaceId || resolvedPlaceId === "pending-likes") {
        logger.warn("Missing place_id for swipe payload", {
          targetUserId: profile.user_id,
          placeId: resolvedPlaceId,
        });
        return;
      }
      const { instantMatch } = await queueSwipe({
        targetUserId: profile.user_id,
        action: "like",
        placeIdOverride: resolvedPlaceId,
      });
      if (instantMatch) {
        setMatchProfile(profile);
        setLastSwipeWasMatch(true);
      }
    })();
  };

  const handlePass = (profile: ActiveUserAtPlace) => {
    swipedIdsRef.current.add(profile.user_id);
    lastSwipeIdRef.current = profile.user_id;
    setLastSwipedProfile(profile);
    setLastSwipeWasMatch(false);
    setRewindUsedForCurrent(false);

    const resolvedPlaceId = profile.place_id ?? placeId;
    if (!resolvedPlaceId || resolvedPlaceId === "pending-likes") {
      logger.warn("Missing place_id for swipe payload", {
        targetUserId: profile.user_id,
        placeId: resolvedPlaceId,
      });
      return;
    }
    void queueSwipe({
      targetUserId: profile.user_id,
      action: "dislike",
      placeIdOverride: resolvedPlaceId,
    });
  };

  const canAttemptRewind = Boolean(lastSwipedProfile) && !rewindUsedForCurrent;

  const handleRewind = () => {
    if (!lastSwipedProfile) return;
    if (rewindUsedForCurrent) return;
    if (lastSwipeWasMatch) {
      Alert.alert(
        t("placePeople.rewindBlockedTitle"),
        t("placePeople.rewindBlockedDescription"),
      );
      return;
    }
    if (!isPremium) {
      router.push("/(modals)/premium-paywall");
      return;
    }

    swipedIdsRef.current.delete(lastSwipedProfile.user_id);
    void removeQueuedSwipes({
      database,
      targetUserIds: [lastSwipedProfile.user_id],
    });
    setIsDeckExhausted(false);
    setRewindUsedForCurrent(true);
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const handleComplete = () => {
    logger.info("No more profiles");
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
          !swipedIdsRef.current.has(profile.user_id),
      ),
    [availableProfiles],
  );

  const showEmpty =
    !loading &&
    (deck.length === 0 || isDeckExhausted) &&
    !hasAvailableToAppend &&
    !isRefilling;
  const showSwiper = !loading && !showEmpty && remaining > 0;

  useEffect(() => {
    if (!showSwiper) return;
    if (remaining > 3) return;
    if (isRefilling) return;
    if (hasInitialUsers) return;
    if (currentIndex === 0) return;
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

  const handleSendMessage = () => {
    setMatchProfile(null);
    router.dismissAll();
    setTimeout(() => {
      router.replace("/(tabs)/(chat)");
    }, 100);
  };

  return (
    <View style={styles.screenContainer}>
      <ItsMatchModal
        isOpen={Boolean(matchProfile)}
        onClose={() => setMatchProfile(null)}
        onSendMessage={handleSendMessage}
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
            currentIndex={currentIndex}
            currentPlaceId={place.id}
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
            onRewind={handleRewind}
            isRewindDisabled={!canAttemptRewind}
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
    bottom: spacing.xxl * 2,
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
