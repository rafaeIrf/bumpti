import { MapPinIcon, SearchIcon, SlidersHorizontalIcon } from "@/assets/icons";
import {
  BarsIcon,
  ClubIcon,
  CoffeIcon,
  FavoritesIcon,
  Heart,
  HotspotsIcon,
  MealIcon,
  NearbyIcon,
  NightclubIcon,
  ParkIcon,
  Passion,
  PopularIcon,
  RadarIcon,
  RunningIcon,
  StadiumIcon,
  UniversityIcon,
} from "@/assets/illustrations";
import { BumptiWideLogo } from "@/assets/images";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { CategoryCard } from "@/components/category-card";
import { DetectionBanner } from "@/components/detection-banner/DetectionBanner";
import { MyCampusCard } from "@/components/my-campus-card";
import { PlaceCardFeatured } from "@/components/place-card-featured";
import { PlanHero } from "@/components/plan-hero";
import { ScreenSectionHeading } from "@/components/screen-section-heading";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
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
import { useActiveCategories } from "@/modules/app";
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
  const { location } = useCachedLocation();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
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

  // Detection banner with smart cooldowns and dismissal
  const { place: detectedPlace, dismiss: dismissDetectedPlace } =
    useDetectionBanner({
      latitude: location?.latitude,
      longitude: location?.longitude,
      accuracy: location?.accuracy,
      enabled: !!location?.latitude && !!location?.longitude,
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

  const nearbyCategory: Category = {
    id: "nearby",
    icon: MapPinIcon,
    title: t("screens.home.categories.nearby.title"),
    description: t("screens.home.categories.nearby.description"),
    iconColor: "#FFFFFF",
    iconBgColor: "rgba(255, 255, 255, 0.2)",
    color: colors.pastelTeal,
    illustration: NearbyIcon,
  };

  const categories: Category[] = [
    {
      id: "highlighted",
      icon: RadarIcon,
      title: t("screens.home.categories.highlighted.title"),
      description: t("screens.home.categories.highlighted.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      color: colors.pastelPurple,
      illustration: Passion,
    },
    {
      id: "most_frequent",
      icon: HotspotsIcon,
      title: t("screens.home.categories.ranking.title"),
      description: t("screens.home.categories.ranking.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      color: colors.pastelPurple,
      illustration: Passion,
    },
    {
      id: "favorites",
      icon: FavoritesIcon,
      title: t("screens.home.categories.favorites.title"),
      description: t("screens.home.categories.favorites.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      color: colors.pastelBlue,
      illustration: Heart,
    },
    {
      id: "community_favorites",
      icon: PopularIcon,
      title: t("screens.home.categories.communityFavorites.title"),
      description: t("screens.home.categories.communityFavorites.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      color: colors.pastelPurple,
      illustration: Heart, // Reusing Heart illustration as it fits "Favorites"
    },
    {
      id: "university",
      title: t("screens.home.categories.university.title"),
      description: t("screens.home.categories.university.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      category: ["university"],
      color: colors.pastelBlue,
      illustration: UniversityIcon,
    },
    {
      id: "bars",
      title: t("screens.home.categories.nightlife.title"),
      description: t("screens.home.categories.nightlife.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      category: ["bar"],
      color: colors.pastelPurple,
      illustration: BarsIcon,
    },
    {
      id: "nightclubs",
      title: t("screens.home.categories.nightclubs.title"),
      description: t("screens.home.categories.nightclubs.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      category: ["nightclub"],
      color: colors.pastelPurple,
      illustration: NightclubIcon,
    },
    {
      id: "cafes",
      title: t("screens.home.categories.cafes.title"),
      description: t("screens.home.categories.cafes.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      category: ["cafe"],
      color: colors.pastelCocoa,
      illustration: CoffeIcon,
    },
    {
      id: "fitness",
      title: t("screens.home.categories.fitness.title"),
      description: t("screens.home.categories.fitness.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      category: ["gym"],
      color: colors.pastelBlue,
      illustration: RunningIcon,
    },
    {
      id: "parks",
      title: t("screens.home.categories.parks.title"),
      description: t("screens.home.categories.parks.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      category: ["park"],
      color: colors.pastelTeal,
      illustration: ParkIcon,
    },
    {
      id: "restaurants",
      title: t("screens.home.categories.restaurants.title"),
      description: t("screens.home.categories.restaurants.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      category: ["restaurant"],
      color: colors.pastelCocoa,
      illustration: MealIcon,
    },
    {
      id: "stadium",
      title: t("screens.home.categories.stadium.title"),
      description: t("screens.home.categories.stadium.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      category: ["stadium", "event_venue"],
      color: colors.pastelPurple,
      illustration: StadiumIcon,
    },
    {
      id: "club",
      title: t("screens.home.categories.club.title"),
      description: t("screens.home.categories.club.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      category: ["club", "sports_centre"],
      color: colors.pastelTeal,
      illustration: ClubIcon,
    },
  ];

  const activeCategories = useActiveCategories();

  // Filter categories based on active categories from remote config
  // Keep special categories (favorites, community_favorites, most_frequent) always visible
  // For location-based categories, only show if at least one of its backend categories is active
  const filteredCategories = categories.filter((cat) => {
    // Special categories without backend mapping are always shown
    if (!cat.category || cat.category.length === 0) {
      return true;
    }

    // Check if any of this category's backend types are active
    return cat.category.some((backendCat) =>
      activeCategories.includes(backendCat as any),
    );
  });

  const featuredCategoriesItems = filteredCategories.slice(0, 4);
  const browseCategories = filteredCategories.slice(4);

  const handleCategoryClick = (category: Category) => {
    setSelectedCategory(category.id);

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
            ? {
                nearby: "true",
                categoryName: category.title,
              }
            : category.id === "community_favorites"
              ? {
                  communityFavorites: "true",
                  categoryName: category.title,
                }
              : category.id === "highlighted"
                ? {
                    trending: "true",
                    categoryName: category.title,
                  }
                : category.id === "most_frequent"
                  ? {
                      mostFrequent: "true",
                      categoryName: category.title,
                    }
                  : {
                      category: category.category,
                    }),
        isPremium: "false", // TODO: Get from user premium status
      },
    });
    setSelectedCategory(null);
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
      <ThemedView style={styles.mainContent}>
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

        {/* Title Section */}
        {/* <ScreenSectionHeading
          titleStyle={{ marginTop: 24 }}
          title={t("screens.home.heroTitle")}
          subtitle={t("screens.home.heroSubtitle")}
        /> */}

        <ThemedView style={styles.contentContainer}>
          {/* Featured Section */}
          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <View style={styles.gridContainer}>
              {featuredCategoriesItems.map((item) => (
                <PlaceCardFeatured
                  key={item.id}
                  title={item.title}
                  icon={item.icon}
                  color={item.color}
                  onClick={() => handleCategoryClick(item)}
                  containerStyle={styles.featuredItem}
                  count={item.id === "highlighted" ? trendingCount : undefined}
                />
              ))}
            </View>
          </Animated.View>

          {/* My Campus Card - Between Featured and Nearby */}
          {profile &&
            profile.university_id &&
            profile.show_university_on_home && (
              <>
                <ScreenSectionHeading
                  titleStyle={{ marginTop: 16 }}
                  title={t("screens.home.myCampus.sectionTitle")}
                />
                <MyCampusCard profile={profile} />
              </>
            )}

          {/* Nearby Section - Between Featured and Explore */}
          {/* Intermediate Section - Nearby & Explore */}
          <Animated.View entering={FadeInDown.delay(250).springify()}>
            <ScreenSectionHeading
              titleStyle={{ marginTop: 16 }}
              title={t("screens.home.intermediateTitle")}
              subtitle={t("screens.home.intermediateSubtitle")}
            />
            <CategoryCard
              category={nearbyCategory}
              isSelected={selectedCategory === nearbyCategory.id}
              onClick={() => handleCategoryClick(nearbyCategory)}
              color={nearbyCategory.color}
              illustration={nearbyCategory.illustration}
              style={styles.nearbyCard}
              textStyle={{ textAlign: "left" }}
            />
          </Animated.View>
          {/* Explore Section */}
          <Animated.View entering={FadeInDown.delay(300).springify()}>
            <View style={styles.gridContainer}>
              {browseCategories.map((item, index) => (
                <Animated.View
                  key={item.id}
                  entering={FadeInDown.delay(300 + index * 80).springify()}
                  style={styles.categoryItem}
                >
                  <CategoryCard
                    category={item}
                    isSelected={selectedCategory === item.id}
                    onClick={() => handleCategoryClick(item)}
                    color={item.color}
                    illustration={item.illustration}
                  />
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        </ThemedView>

        {/* Info Card */}
        <Animated.View entering={FadeInDown.delay(700).springify()}>
          <View style={styles.section}>
            <View
              style={[
                styles.infoCard,
                {
                  backgroundColor: colors.surface,
                },
              ]}
            >
              <View style={styles.infoContent}>
                <View style={[styles.infoIconContainer]}>
                  <MapPinIcon width={20} height={20} color={colors.accent} />
                </View>
                <View style={styles.infoTextContainer}>
                  <ThemedText
                    style={[styles.infoTitle, { color: colors.text }]}
                  >
                    {t("screens.home.infoTitle")}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.infoDescription,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {t("screens.home.infoDescription")}
                  </ThemedText>
                </View>
              </View>
            </View>
          </View>
        </Animated.View>
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
  nearbyCard: {
    width: "100%",
    marginTop: 16, // Add space from the section above
    marginBottom: 16,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
  },
  categoryItem: {
    width: "48.5%",
    maxWidth: "48.5%",
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginTop: 24,
  },
  infoContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  infoDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
});
