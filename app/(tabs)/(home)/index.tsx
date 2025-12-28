import {
  BeerIcon,
  CoffeeIcon,
  DumbbellIcon,
  FlameIcon,
  HeartIcon,
  LogoName,
  MapPinIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  StarIcon,
  UtensilsCrossedIcon,
} from "@/assets/icons";
import {
  Cocoa,
  Graduation,
  Heart,
  Location,
  Park,
  Passion,
  Toast,
  Weight,
} from "@/assets/illustrations";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { CategoryCard } from "@/components/category-card";
import { ScreenSectionHeading } from "@/components/screen-section-heading";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useCachedLocation } from "@/hooks/use-cached-location";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { useDetectPlaceQuery } from "@/modules/places/placesApi";
import { PlaceCategory } from "@/modules/places/types";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SvgProps } from "react-native-svg";

interface Category {
  id: string;
  icon: React.ComponentType<{ width: number; height: number; color: string }>;
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
  const [refreshing, setRefreshing] = useState(false);

  // Detect place when location is available
  const { data: detectedPlaceResult } = useDetectPlaceQuery(
    {
      latitude: location?.latitude ?? 0,
      longitude: location?.longitude ?? 0,
      hacc: location?.accuracy,
    },
    {
      skip: !location?.latitude || !location?.longitude,
    }
  );

  useEffect(() => {
    if (detectedPlaceResult?.suggested) {
      console.log("Detected place:", detectedPlaceResult);
      Alert.alert(
        t("screens.home.placeDetected.title"),
        t("screens.home.placeDetected.message", {
          placeName: detectedPlaceResult.suggested.name,
        })
      );
    }
  }, [detectedPlaceResult]);

  const nearbyCategory: Category = {
    id: "nearby",
    icon: MapPinIcon,
    title: t("screens.home.categories.nearby.title"),
    description: t("screens.home.categories.nearby.description"),
    iconColor: "#FFFFFF",
    iconBgColor: "rgba(255, 255, 255, 0.2)",
    color: colors.pastelTeal,
    illustration: Location,
  };

  const categories: Category[] = [
    {
      id: "highlighted",
      icon: FlameIcon,
      title: t("screens.home.categories.highlighted.title"),
      description: t("screens.home.categories.highlighted.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      color: colors.pastelCoral,
      illustration: Passion,
    },
    {
      id: "community_favorites",
      icon: StarIcon,
      title: t("screens.home.categories.communityFavorites.title"),
      description: t("screens.home.categories.communityFavorites.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      color: colors.pastelPink,
      illustration: Heart, // Reusing Heart illustration as it fits "Favorites"
    },
    {
      id: "favorites",
      icon: HeartIcon,
      title: t("screens.home.categories.favorites.title"),
      description: t("screens.home.categories.favorites.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      color: colors.pastelTeal,
      illustration: Heart,
    },
    {
      id: "bars",
      icon: BeerIcon,
      title: t("screens.home.categories.nightlife.title"),
      description: t("screens.home.categories.nightlife.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      category: ["bar", "nightclub"],
      color: colors.pastelPurple,
      illustration: Toast,
    },
    {
      id: "cafes",
      icon: CoffeeIcon,
      title: t("screens.home.categories.cafes.title"),
      description: t("screens.home.categories.cafes.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      category: ["cafe"],
      color: colors.pastelCocoa,
      illustration: Cocoa,
    },
    {
      id: "university",
      icon: MapPinIcon,
      title: t("screens.home.categories.university.title"),
      description: t("screens.home.categories.university.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      category: ["university", "college"],
      color: colors.pastelBlue,
      illustration: Graduation,
    },
    {
      id: "fitness",
      icon: DumbbellIcon,
      title: t("screens.home.categories.fitness.title"),
      description: t("screens.home.categories.fitness.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      category: ["gym", "fitness_centre"],
      color: colors.pastelGreen,
      illustration: Weight,
    },
    {
      id: "parks",
      icon: MapPinIcon,
      title: t("screens.home.categories.parks.title"),
      description: t("screens.home.categories.parks.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      category: ["park"],
      color: colors.pastelGreen,
      illustration: Park,
    },
    {
      id: "restaurants",
      icon: UtensilsCrossedIcon,
      title: t("screens.home.categories.restaurants.title"),
      description: t("screens.home.categories.restaurants.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      category: ["restaurant"],
      color: colors.pastelCocoa,
      illustration: Location,
    },
    {
      id: "museum",
      icon: MapPinIcon,
      title: t("screens.home.categories.museum.title"),
      description: t("screens.home.categories.museum.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      category: ["museum"],
      color: colors.pastelPurple,
      illustration: Passion,
    },
    {
      id: "library",
      icon: MapPinIcon,
      title: t("screens.home.categories.library.title"),
      description: t("screens.home.categories.library.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      category: ["library"],
      color: colors.pastelBlue,
      illustration: Graduation,
    },
    {
      id: "stadium",
      icon: MapPinIcon,
      title: t("screens.home.categories.stadium.title"),
      description: t("screens.home.categories.stadium.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      category: ["stadium", "events_venue"],
      color: colors.pastelGreen,
      illustration: Weight,
    },
    {
      id: "club",
      icon: MapPinIcon,
      title: t("screens.home.categories.club.title"),
      description: t("screens.home.categories.club.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      category: ["club", "sports_centre"],
      color: colors.pastelPurple,
      illustration: Passion,
    },
  ];

  const featuredCategoriesItems = categories.slice(0, 3);
  const browseCategories = categories.slice(3);

  const handleCategoryClick = (category: Category) => {
    setSelectedCategory(category.id);
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
          : {
              category: category.category,
            }),
        isPremium: "false", // TODO: Get from user premium status
      },
    });
    setSelectedCategory(null);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // TODO: Fetch real data
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const handleOpenSearch = () => {
    router.push("/place-search");
  };

  return (
    <BaseTemplateScreen
      TopHeader={
        <ScreenToolbar
          customTitleView={<LogoName />}
          titleIconColor={colors.accent}
          rightActions={[
            {
              icon: SlidersHorizontalIcon,
              onClick: () => router.push("main/filters" as any),
              ariaLabel: t("screens.home.toolbar.filters"),
              color: colors.icon,
            },
            {
              icon: SearchIcon,
              onClick: handleOpenSearch,
              ariaLabel: t("screens.home.toolbar.search"),
              color: colors.icon,
            },
          ]}
        />
      }
      refreshing={refreshing}
      onRefresh={handleRefresh}
    >
      <ThemedView>
        {/* Title Section */}
        <ScreenSectionHeading
          titleStyle={{ marginTop: 24 }}
          title={t("screens.home.heroTitle")}
          subtitle={t("screens.home.heroSubtitle")}
        />

        <ThemedView style={styles.contentContainer}>
          {/* Featured Section */}
          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredList}
            >
              {featuredCategoriesItems.map((item) => (
                <CategoryCard
                  key={item.id}
                  category={item}
                  isSelected={selectedCategory === item.id}
                  onClick={() => handleCategoryClick(item)}
                  color={item.color}
                  illustration={item.illustration}
                  style={styles.featuredItem}
                />
              ))}
            </ScrollView>
          </Animated.View>

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
          <ThemedView style={styles.section}>
            <ThemedView
              style={[
                styles.infoCard,
                {
                  borderColor: colors.border,
                },
              ]}
            >
              <ThemedView style={styles.infoContent}>
                <ThemedView
                  style={[
                    styles.infoIconContainer,
                    { backgroundColor: `${colors.accent}10` },
                  ]}
                >
                  <MapPinIcon width={20} height={20} color={colors.accent} />
                </ThemedView>
                <ThemedView style={styles.infoTextContainer}>
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
                </ThemedView>
              </ThemedView>
            </ThemedView>
          </ThemedView>
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
    width: "47%",
    maxWidth: "47%",
  },
  nearbyCard: {
    width: "100%",
    marginTop: 16, // Add space from the section above
    marginBottom: 16,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
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
