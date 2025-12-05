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
import { CARD_COLORS, CategoryCard } from "@/components/category-card";
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
import { Alert, FlatList, StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SvgProps } from "react-native-svg";

interface Category {
  id: string;
  icon: React.ComponentType<{ width: number; height: number; color: string }>;
  title: string;
  description: string;
  iconColor: string;
  iconBgColor: string;
  category?: PlaceCategory; // General category name for backend
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

  const categories: Category[] = [
    {
      id: "highlighted",
      icon: FlameIcon,
      title: t("screens.home.categories.highlighted.title"),
      description: t("screens.home.categories.highlighted.description"),
      iconColor: "#FF6B35",
      iconBgColor: "rgba(41, 151, 255, 0.12)",
      color: CARD_COLORS.bloodOrange,
      illustration: Passion,
    },
    {
      id: "favorites",
      icon: HeartIcon,
      title: t("screens.home.categories.favorites.title"),
      description: t("screens.home.categories.favorites.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(41, 151, 255, 0.12)",
      color: CARD_COLORS.red,
      illustration: Heart,
    },
    {
      id: "bars",
      icon: BeerIcon,
      title: t("screens.home.categories.nightlife.title"),
      description: t("screens.home.categories.nightlife.description"),
      iconColor: "#FF8A33",
      iconBgColor: "rgba(255, 138, 51, 0.12)",
      category: "bars",
      color: CARD_COLORS.heatBurst,
      illustration: Toast,
    },
    {
      id: "cafes",
      icon: CoffeeIcon,
      title: t("screens.home.categories.cafes.title"),
      description: t("screens.home.categories.cafes.description"),
      iconColor: "#9B6C4A",
      iconBgColor: "rgba(155, 108, 74, 0.12)",
      category: "cafes",
      color: CARD_COLORS.apricotPastel,
      illustration: Cocoa,
    },
    {
      id: "university",
      icon: MapPinIcon,
      title: t("screens.home.categories.university.title"),
      description: t("screens.home.categories.university.description"),
      iconColor: "#3DAAFF",
      iconBgColor: "rgba(61, 170, 255, 0.12)",
      category: "university",
      color: CARD_COLORS.azurePop,
      illustration: Graduation,
    },
    {
      id: "fitness",
      icon: DumbbellIcon,
      title: t("screens.home.categories.fitness.title"),
      description: t("screens.home.categories.fitness.description"),
      iconColor: "#1DB954",
      iconBgColor: "rgba(29, 185, 84, 0.12)",
      category: "fitness",
      color: CARD_COLORS.aquaPastel,
      illustration: Weight,
    },
    {
      id: "parks",
      icon: MapPinIcon,
      title: t("screens.home.categories.parks.title"),
      description: t("screens.home.categories.parks.description"),
      iconColor: "#34C759",
      iconBgColor: "rgba(52, 199, 89, 0.12)",
      category: "parks",
      color: CARD_COLORS.neonMint,
      illustration: Park,
    },
    {
      id: "restaurants",
      icon: UtensilsCrossedIcon,
      title: t("screens.home.categories.restaurants.title"),
      description: t("screens.home.categories.restaurants.description"),
      iconColor: "#FF6B35",
      iconBgColor: "rgba(255, 107, 53, 0.12)",
      category: "restaurants",
      color: CARD_COLORS.twilightRose,
      illustration: Location,
    },
  ];

  const handleCategoryClick = (category: Category) => {
    setSelectedCategory(category.id);
    router.push({
      pathname: "/main/category-results",
      params: {
        categoryName: category.title,
        ...(category.id === "favorites"
          ? { favorites: "true" }
          : category.id === "highlighted"
          ? { trending: "true" }
          : {
              category: category.category, // Pass general category name
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

        {/* Categories List */}
        <FlatList
          data={categories}
          keyExtractor={(item) => item.id}
          numColumns={2}
          scrollEnabled={false}
          renderItem={({ item, index }) => {
            const isSelected = selectedCategory === item.id;
            return (
              <Animated.View
                entering={FadeInDown.delay(300 + index * 80).springify()}
                style={styles.categoryItem}
              >
                <CategoryCard
                  category={item}
                  isSelected={isSelected}
                  onClick={() => handleCategoryClick(item)}
                  color={item.color}
                  illustration={item.illustration}
                />
              </Animated.View>
            );
          }}
          columnWrapperStyle={styles.categoryColumnWrapper}
          contentContainerStyle={styles.categoriesList}
        />

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
  emptyCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
  },
  emptyText: {
    textAlign: "center",
    lineHeight: 22,
  },
  categoriesList: {
    paddingTop: 24,
    paddingBottom: 8,
  },
  categoryColumnWrapper: {
    justifyContent: "flex-start",
    marginBottom: 4,
    gap: 4,
  },
  categoryItem: {
    width: "48%",
    maxWidth: "48%",
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
