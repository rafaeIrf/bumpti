import { ArrowLeftIcon, MapPinIcon } from "@/assets/icons";
import {
  BarsIcon,
  ClubIcon,
  CoffeIcon,
  MealIcon,
  NearbyIcon,
  NightclubIcon,
  ParkIcon,
  RunningIcon,
  StadiumIcon,
  UniversityIcon,
} from "@/assets/illustrations";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { CategoryCard } from "@/components/category-card";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedView } from "@/components/themed-view";
import { spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  ANALYTICS_EVENTS,
  trackEvent,
  useScreenTracking,
} from "@/modules/analytics";
import { useActiveCategories } from "@/modules/app";
import { t } from "@/modules/locales";
import { PlaceCategory } from "@/modules/places/types";
import { router } from "expo-router";
import React, { useState } from "react";
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
  category?: PlaceCategory[];
  color: string;
  illustration?: React.ComponentType<SvgProps>;
}

export default function ExploreCategoriesScreen() {
  const colors = useThemeColors();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useScreenTracking({ screenName: "explore_categories" });

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

  const filteredCategories = categories.filter((cat) => {
    if (!cat.category || cat.category.length === 0) {
      return true;
    }
    return cat.category.some((backendCat) =>
      activeCategories.includes(backendCat as any),
    );
  });

  const browseItems = filteredCategories;

  const handleCategoryClick = (category: Category) => {
    setSelectedCategory(category.id);

    trackEvent(ANALYTICS_EVENTS.HOME.CATEGORY_CLICKED, {
      categoryId: category.id,
      categoryName: category.title,
      source: "explore_categories",
    });

    router.push({
      pathname: "/main/category-results",
      params: {
        categoryName: category.title,
        ...(category.id === "nearby"
          ? { nearby: "true" }
          : { category: category.category }),
        isPremium: "false",
      },
    });
    setSelectedCategory(null);
  };

  return (
    <BaseTemplateScreen
      TopHeader={
        <ScreenToolbar
          title={t("screens.home.explorePlaces.title")}
          leftAction={{
            icon: ArrowLeftIcon,
            onClick: () => router.back(),
            ariaLabel: t("common.back"),
          }}
        />
      }
    >
      <ThemedView>
        {/* Nearby */}
        <Animated.View entering={FadeInDown.delay(150).springify()}>
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

        {/* Browse Categories Grid */}
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <View style={styles.gridContainer}>
            {browseItems.map((item, index) => (
              <Animated.View
                key={item.id}
                entering={FadeInDown.delay(200 + index * 60).springify()}
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
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
  },
  nearbyCard: {
    width: "100%",
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  categoryItem: {
    width: "48.5%",
    maxWidth: "48.5%",
  },
});
