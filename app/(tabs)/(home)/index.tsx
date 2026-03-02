import {
  CalendarIcon,
  FlameIcon,
  MapIcon,
  SlidersHorizontalIcon,
} from "@/assets/icons";

import { BumptiWideLogo } from "@/assets/images";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { DetectionBanner } from "@/components/detection-banner/DetectionBanner";
import { GradientActionCard } from "@/components/gradient-action-card";
import { MyHubsSection } from "@/components/my-hubs-section";

import { PlanHero } from "@/components/plan-hero";
import { ScreenSectionHeading } from "@/components/screen-section-heading";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedView } from "@/components/themed-view";
import { spacing } from "@/constants/theme";
import { useCachedLocation } from "@/hooks/use-cached-location";
import { useDetectionBanner } from "@/hooks/use-detection-banner";
import { usePermissionSheet } from "@/hooks/use-permission-sheet";
import { usePlaceClick } from "@/hooks/use-place-click";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  ANALYTICS_EVENTS,
  trackEvent,
  useScreenTracking,
} from "@/modules/analytics";
import { t } from "@/modules/locales";
import type { DetectedPlace } from "@/modules/places/api";
import { useGetTrendingPlacesQuery } from "@/modules/places/placesApi";
import { fetchSuggestedPlans } from "@/modules/plans/api";
import { useUserPlans } from "@/modules/plans/hooks";
import { updateProfile } from "@/modules/profile/api";
import { useAppDispatch, useAppSelector } from "@/modules/store/hooks";
import { setProfile } from "@/modules/store/slices/profileSlice";
import { logger } from "@/utils/logger";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

export default function HomeScreen() {
  const colors = useThemeColors();
  const { location, cityOverride } = useCachedLocation();
  const [isConnecting, setIsConnecting] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [todayPlansCount, setTodayPlansCount] = useState(0);

  // Get user profile for MyCampusCard
  const profile = useAppSelector((state) => state.profile.data);
  const dispatch = useAppDispatch();

  // Get user plans for PlanHero carousel
  const { sortedPlans, initialIndex } = useUserPlans();

  // Fetch today's plans count for PlanHero social proof
  useEffect(() => {
    if (!location?.latitude || !location?.longitude) return;
    fetchSuggestedPlans(location.latitude, location.longitude).then(
      ({ totalCount }) => setTodayPlansCount(totalCount),
    );
  }, [location?.latitude, location?.longitude]);

  // Detection banner — disabled when city override is active (user is browsing remotely)
  const { place: detectedPlace, dismiss: dismissDetectedPlace } =
    useDetectionBanner({
      latitude: location?.latitude,
      longitude: location?.longitude,
      accuracy: location?.accuracy,
      enabled: !!location?.latitude && !!location?.longitude && !cityOverride,
    });

  // Place click handler for auto check-in
  const { handlePlaceClick } = usePlaceClick();

  // Trending places count for "No radar" card
  const { data: trendingData } = useGetTrendingPlacesQuery(
    location?.latitude && location?.longitude
      ? {
          lat: location.latitude,
          lng: location.longitude,
          page: 1,
          pageSize: 20,
        }
      : undefined,
    {
      skip: !location?.latitude || !location?.longitude,
      refetchOnMountOrArgChange: 15, // Refetch if data is older than 15 seconds
    },
  );
  // Use actual count of places in the filtered array, not backend totalCount
  // This ensures the count updates when places with 0 active_users are filtered out
  const trendingCount = trendingData?.places?.length ?? 0;

  // Track detection banner shown
  useEffect(() => {
    if (detectedPlace) {
      trackEvent(ANALYTICS_EVENTS.HOME.DETECTION_BANNER_SHOWN, {
        placeId: detectedPlace.id,
      });
    }
  }, [detectedPlace]);

  // Track detection banner dismiss
  const handleDismissDetection = useCallback(() => {
    if (detectedPlace) {
      trackEvent(ANALYTICS_EVENTS.HOME.DETECTION_BANNER_DISMISS, {
        placeId: detectedPlace.id,
      });
    }
    dismissDetectedPlace();
  }, [detectedPlace, dismissDetectedPlace]);

  const {
    showLocationSheet,
    showNotificationSheet,
    showTrackingSheet,
    locationHandled,
    notificationHandled,
  } = usePermissionSheet();

  // Show ATT education sheet for returning users (who skip intro carousel)
  useEffect(() => {
    showTrackingSheet();
  }, [showTrackingSheet]);

  // Track screen view
  useScreenTracking({ screenName: "home" });

  useEffect(() => {
    // Show location sheet first if not yet handled (granted or dismissed)
    if (!locationHandled) {
      showLocationSheet();
    } else if (!notificationHandled) {
      // Once location is handled, show notification sheet with a delay
      // to ensure the location sheet animation has completed
      const timer = setTimeout(() => {
        showNotificationSheet();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [
    locationHandled,
    notificationHandled,
    showLocationSheet,
    showNotificationSheet,
  ]);

  const handleHighlightedClick = () => {
    trackEvent(ANALYTICS_EVENTS.HOME.CATEGORY_CLICKED, {
      categoryId: "highlighted",
      categoryName: t("screens.home.categories.highlighted.title"),
    });
    router.push({
      pathname: "/main/category-results",
      params: {
        categoryName: t("screens.home.categories.highlighted.title"),
        trending: "true",
        isPremium: "false",
      },
    });
  };

  const handleConnectPlace = async (placeData: DetectedPlace) => {
    // Auto check-in at detected place
    if (!detectedPlace || isConnecting) return;

    // Track detection banner connect
    trackEvent(ANALYTICS_EVENTS.HOME.DETECTION_BANNER_CONNECT, {
      placeId: placeData.id,
    });

    setIsConnecting(true);
    try {
      await handlePlaceClick({
        placeId: placeData.id,
        name: placeData.name,
        latitude: placeData.latitude,
        longitude: placeData.longitude,
        distance: placeData.dist_meters ? placeData.dist_meters / 1000 : 0,
        active_users: placeData.active_users || 0,
      });
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <BaseTemplateScreen
      ignoreBottomSafeArea
      TopHeader={
        <ScreenToolbar
          leftAction={{
            icon: SlidersHorizontalIcon,
            onClick: () => {
              trackEvent(ANALYTICS_EVENTS.HOME.FILTER_OPENED, {});
              router.push("main/filters" as any);
            },
            ariaLabel: t("screens.home.toolbar.filters"),
            color: colors.icon,
          }}
          customTitleView={<BumptiWideLogo height={28} width={100} />}
          titleIconColor={colors.accent}
        />
      }
    >
      {/* Main Content */}
      <ThemedView>
        {/* Detection Banner - Fixed at top */}
        {detectedPlace && (
          <DetectionBanner
            place={detectedPlace}
            onConnect={handleConnectPlace}
            onDismiss={handleDismissDetection}
            isConnecting={isConnecting}
          />
        )}
        <ThemedView>
          {/* Plan Hero - Create or view plans */}
          <PlanHero
            plans={sortedPlans}
            initialIndex={initialIndex}
            loading={planLoading}
            defaultConfirmedCount={todayPlansCount}
            onViewPeoplePress={async (plan) => {
              setPlanLoading(true);
              try {
                await handlePlaceClick({
                  placeId: plan.placeId,
                  name: plan.locationName,
                  latitude: 0,
                  longitude: 0,
                  distance: 0,
                  active_users: plan.confirmedCount,
                });
              } finally {
                setPlanLoading(false);
              }
            }}
          />
          {/* My Hubs Section */}
          <GradientActionCard
            style={{ marginTop: spacing.smd }}
            title={t("screens.home.categories.highlighted.title")}
            subtitle={
              trendingCount > 0
                ? t("screens.home.categories.highlighted.activePlaces", {
                    count: trendingCount,
                  })
                : t("screens.home.categories.highlighted.noActivePlaces")
            }
            gradientColors={["#7E57C2", "#B39DDB"]}
            icon={FlameIcon}
            onPress={handleHighlightedClick}
            showChevron
          />
          <GradientActionCard
            style={{ marginTop: spacing.smd }}
            title={t("screens.home.myPlans.cardTitle")}
            subtitle={t("screens.home.myPlans.cardSubtitle")}
            gradientColors={["#4B87B9", "#64B5F6", "#87C8F8"]}
            gradientLocations={[0, 0.5, 1]}
            icon={CalendarIcon}
            onPress={() => router.push("/main/my-plans")}
            showChevron
          />
          <ScreenSectionHeading
            titleStyle={{ marginTop: spacing.smd, marginBottom: spacing.sm }}
            title={t("screens.home.myHubs.sectionTitle")}
          />
          <MyHubsSection
            hubs={profile?.socialHubs ?? []}
            onAddHubs={() => router.push("/(modals)/social-hubs")}
            onReorder={(orderedIds) => {
              if (!profile) return;
              // Reorder socialHubs array to match orderedIds
              const hubMap = new Map(
                (profile.socialHubs ?? []).map((h: any) => [h.id, h]),
              );
              const reordered = orderedIds
                .map((id) => hubMap.get(id))
                .filter(Boolean);

              // Optimistic update
              dispatch(setProfile({ ...profile, socialHubs: reordered }));

              // Persist in background
              updateProfile({ socialHubs: orderedIds }).catch((error) => {
                logger.error("Failed to reorder social hubs", error);
              });
            }}
          />
          {/* Explore Categories CTA */}
          <Animated.View entering={FadeInDown.delay(250).springify()}>
            <GradientActionCard
              style={{ marginTop: spacing.lg }}
              title={t("screens.home.explorePlaces.title")}
              subtitle={t("screens.home.explorePlaces.subtitle")}
              gradientColors={["#FF7A5C", "#E94B7D"]}
              icon={MapIcon}
              iconSize={28}
              onPress={() => router.push("/main/explore-categories")}
              showChevron
            />
          </Animated.View>
        </ThemedView>
      </ThemedView>
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingTop: 24,
  },
  sectionHeading: {
    marginBottom: 12,
  },
});
