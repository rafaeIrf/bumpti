import { FlameIcon, SearchIcon, SlidersHorizontalIcon } from "@/assets/icons";
import {
  Heart,
  HotspotsIcon,
  Passion,
  PopularIcon,
} from "@/assets/illustrations";
import { BumptiWideLogo } from "@/assets/images";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { DetectionBanner } from "@/components/detection-banner/DetectionBanner";
import { ExploreCategoriesCard } from "@/components/explore-categories-card";
import { HighlightedHeroCard } from "@/components/highlighted-hero-card";
import { MyHubsSection } from "@/components/my-hubs-section";
import { PlaceCardFeatured } from "@/components/place-card-featured";
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
import { PlaceCategory } from "@/modules/places/types";
import { fetchSuggestedPlans } from "@/modules/plans/api";
import { useUserPlans } from "@/modules/plans/hooks";
import { useAppSelector } from "@/modules/store/hooks";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SvgProps } from "react-native-svg";

interface Category {
  id: string;
  icon?: React.ComponentType<{ width: number; height: number; color: string }>;
  title: string;
  description: string;
  iconColor: string;
  iconBgColor: string;
  category?: PlaceCategory[]; // General category name for backend
  color: string;
  illustration?: React.ComponentType<SvgProps>;
}

export default function HomeScreen() {
  const colors = useThemeColors();
  const { location, cityOverride } = useCachedLocation();
  const [isConnecting, setIsConnecting] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [todayPlansCount, setTodayPlansCount] = useState(0);

  // Get user profile for MyCampusCard
  const profile = useAppSelector((state) => state.profile.data);

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

  const highlightedCategory: Category = {
    id: "highlighted",
    icon: FlameIcon,
    title: t("screens.home.categories.highlighted.title"),
    description: t("screens.home.categories.highlighted.description"),
    iconColor: colors.white,
    iconBgColor: "rgba(255, 255, 255, 0.2)",
    color: colors.pastelPurple,
    illustration: FlameIcon,
  };

  const featuredCategoriesItems: Category[] = [
    {
      id: "most_frequent",
      icon: HotspotsIcon,
      title: t("screens.home.categories.ranking.title"),
      description: t("screens.home.categories.ranking.description"),
      iconColor: "#7050C4",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      color: colors.pastelPurple,
      illustration: Passion,
    },
    {
      id: "community_favorites",
      icon: PopularIcon,
      title: t("screens.home.categories.communityFavorites.title"),
      description: t("screens.home.categories.communityFavorites.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      color: colors.pastelPurple,
      illustration: Heart,
    },
  ];

  const handleCategoryClick = (category: Category) => {
    // Track category click
    trackEvent(ANALYTICS_EVENTS.HOME.CATEGORY_CLICKED, {
      categoryId: category.id,
      categoryName: category.title,
    });

    router.push({
      pathname: "/main/category-results",
      params: {
        categoryName: category.title,
        ...(category.id === "favorites"
          ? { favorites: "true" }
          : category.id === "nearby"
            ? { nearby: "true" }
            : category.id === "community_favorites"
              ? { communityFavorites: "true" }
              : category.id === "highlighted"
                ? { trending: "true" }
                : category.id === "most_frequent"
                  ? { mostFrequent: "true" }
                  : { category: category.category }),
        isPremium: "false",
      },
    });
  };

  const handleOpenSearch = () => {
    trackEvent(ANALYTICS_EVENTS.HOME.SEARCH_OPENED, {});
    router.push("/main/place-search");
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
          rightActions={[
            {
              icon: SearchIcon,
              onClick: handleOpenSearch,
              ariaLabel: t("screens.home.toolbar.search"),
              color: colors.icon,
            },
          ]}
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

        {/* No Radar — compact gradient hero card */}
        <HighlightedHeroCard
          title={highlightedCategory.title}
          description={highlightedCategory.description}
          count={trendingCount}
          onPress={() => handleCategoryClick(highlightedCategory)}
        />

        <ThemedView style={styles.contentContainer}>
          {/* My Hubs Section */}
          <ScreenSectionHeading
            titleStyle={{ marginTop: spacing.md, marginBottom: spacing.sm }}
            title={t("screens.home.myHubs.sectionTitle")}
          />
          <MyHubsSection
            hubs={profile?.socialHubs ?? []}
            onAddHubs={() => router.push("/(profile)/social-hubs")}
          />

          {/* Featured Section */}
          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <View style={[styles.gridContainer, { marginTop: spacing.md }]}>
              {featuredCategoriesItems.map((item) => (
                <PlaceCardFeatured
                  key={item.id}
                  title={item.title}
                  icon={item.icon}
                  iconColor={item.iconColor}
                  color={item.color}
                  onClick={() => handleCategoryClick(item)}
                  containerStyle={styles.featuredItem}
                />
              ))}
            </View>
          </Animated.View>

          {/* Explore Categories CTA */}
          <Animated.View entering={FadeInDown.delay(250).springify()}>
            <View style={{ marginTop: spacing.md }}>
              <ExploreCategoriesCard
                onPress={() => router.push("/main/explore-categories")}
              />
            </View>
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
  contentContainer: {
    paddingTop: 16,
  },
  sectionHeading: {
    marginBottom: 12,
  },
  featuredList: {
    gap: 8,
    paddingRight: 16, // Add padding to the end of the scroll
  },
  featuredItem: {
    width: "48.5%",
    maxWidth: "48.5%",
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
  },
});
