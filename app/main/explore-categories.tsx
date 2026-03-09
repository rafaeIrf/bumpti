import {
  ArrowLeftIcon,
  AwardIcon,
  BeerIcon,
  CircleStarIcon,
  CoffeeIcon,
  DumbbellIcon,
  GraduationCapIcon,
  MartiniIcon,
  TreesIcon,
  TrendingUpIcon,
  UsersIcon,
  UtensilsCrossedIcon,
} from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { PlaceCardFeatured } from "@/components/place-card-featured";
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
import React from "react";
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

  useScreenTracking({ screenName: "explore_categories" });

  const categories: Category[] = [
    {
      id: "university",
      title: t("screens.home.categories.university.title"),
      description: t("screens.home.categories.university.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      category: ["university"],
      color: colors.pastelBlue,
      illustration: GraduationCapIcon,
    },
    {
      id: "bars",
      title: t("screens.home.categories.nightlife.title"),
      description: t("screens.home.categories.nightlife.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      category: ["bar"],
      color: colors.pastelPurple,
      illustration: BeerIcon,
    },
    {
      id: "nightclubs",
      title: t("screens.home.categories.nightclubs.title"),
      description: t("screens.home.categories.nightclubs.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      category: ["nightclub"],
      color: colors.pastelPurple,
      illustration: MartiniIcon,
    },
    {
      id: "cafes",
      title: t("screens.home.categories.cafes.title"),
      description: t("screens.home.categories.cafes.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      category: ["cafe"],
      color: colors.pastelCocoa,
      illustration: CoffeeIcon,
    },
    {
      id: "fitness",
      title: t("screens.home.categories.fitness.title"),
      description: t("screens.home.categories.fitness.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      category: ["gym"],
      color: colors.pastelBlue,
      illustration: DumbbellIcon,
    },
    {
      id: "parks",
      title: t("screens.home.categories.parks.title"),
      description: t("screens.home.categories.parks.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      category: ["park"],
      color: colors.pastelTeal,
      illustration: TreesIcon,
    },
    {
      id: "restaurants",
      title: t("screens.home.categories.restaurants.title"),
      description: t("screens.home.categories.restaurants.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      category: ["restaurant"],
      color: colors.pastelCocoa,
      illustration: UtensilsCrossedIcon,
    },
    {
      id: "stadium",
      title: t("screens.home.categories.stadium.title"),
      description: t("screens.home.categories.stadium.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      category: ["stadium", "event_venue"],
      color: colors.pastelTeal,
      illustration: AwardIcon,
    },
    {
      id: "club",
      title: t("screens.home.categories.club.title"),
      description: t("screens.home.categories.club.description"),
      iconColor: "#FFFFFF",
      iconBgColor: "rgba(255, 255, 255, 0.2)",
      category: ["club", "sports_centre"],
      color: colors.pastelTeal,
      illustration: UsersIcon,
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
    trackEvent(ANALYTICS_EVENTS.HOME.CATEGORY_CLICKED, {
      categoryId: category.id,
      categoryName: category.title,
      source: "explore_categories",
    });

    router.push({
      pathname: "/main/category-results",
      params: {
        categoryName: category.title,
        category: category.category,
        isPremium: "false",
      },
    });
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
        {/* Featured: +Frequentados & Populares */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <View
            style={[
              styles.gridContainer,
              { marginTop: spacing.smd, marginBottom: spacing.smd },
            ]}
          >
            <PlaceCardFeatured
              title={t("screens.home.categories.ranking.title")}
              icon={TrendingUpIcon}
              iconColor="#FFFFFF"
              color={colors.pastelPurple}
              onClick={() => {
                trackEvent(ANALYTICS_EVENTS.HOME.CATEGORY_CLICKED, {
                  categoryId: "most_frequent",
                  categoryName: t("screens.home.categories.ranking.title"),
                  source: "explore_categories",
                });
                router.push({
                  pathname: "/main/category-results",
                  params: {
                    categoryName: t("screens.home.categories.ranking.title"),
                    mostFrequent: "true",
                    isPremium: "false",
                  },
                });
              }}
              containerStyle={styles.featuredItem}
            />
            <PlaceCardFeatured
              title={t("screens.home.categories.communityFavorites.title")}
              icon={CircleStarIcon}
              iconColor="#FFFFFF"
              color={colors.pastelPurple}
              onClick={() => {
                trackEvent(ANALYTICS_EVENTS.HOME.CATEGORY_CLICKED, {
                  categoryId: "community_favorites",
                  categoryName: t(
                    "screens.home.categories.communityFavorites.title",
                  ),
                  source: "explore_categories",
                });
                router.push({
                  pathname: "/main/category-results",
                  params: {
                    categoryName: t(
                      "screens.home.categories.communityFavorites.title",
                    ),
                    communityFavorites: "true",
                    isPremium: "false",
                  },
                });
              }}
              containerStyle={styles.featuredItem}
            />
          </View>
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
                <PlaceCardFeatured
                  title={item.title}
                  icon={item.illustration}
                  iconColor="#FFFFFF"
                  color={item.color}
                  onClick={() => handleCategoryClick(item)}
                  containerStyle={styles.categoryCard}
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
  },
  featuredItem: {
    width: "48.5%",
  },
  categoryItem: {
    width: "48.5%",
    marginBottom: spacing.smd,
  },
  categoryCard: {
    height: 96,
  },
});
