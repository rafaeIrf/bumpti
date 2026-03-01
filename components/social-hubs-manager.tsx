import {
  BarsIcon,
  CoffeIcon,
  MealIcon,
  NearbyIcon,
  NightclubIcon,
  ParkIcon,
  RunningIcon,
  StadiumIcon,
  UniversityIcon,
} from "@/assets/illustrations";
import { HubCategory, HubCategoryCard } from "@/components/hub-category-card";
import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { PlaceCategory } from "@/modules/places/types";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

// ── Constants ──────────────────────────────────────────────────────────────────

export const MAX_SOCIAL_HUBS = 6;

// Maps backend PlaceCategory values to grid card IDs
const CATEGORY_TO_GRID_ID: Partial<Record<PlaceCategory, string>> = {
  gym: "fitness",
  university: "university",
  park: "parks",
  bar: "bars",
  nightclub: "nightclubs",
  stadium: "stadium",
  event_venue: "stadium",
  cafe: "cafes",
  restaurant: "restaurants",
};

export function mapCategoryToGridId(category: string): string {
  return CATEGORY_TO_GRID_ID[category as PlaceCategory] || "others";
}

// Reverse: grid card ID → first matching backend PlaceCategory
const GRID_ID_TO_CATEGORY: Record<string, PlaceCategory> = Object.entries(
  CATEGORY_TO_GRID_ID,
).reduce(
  (acc, [cat, gridId]) => {
    if (gridId && !acc[gridId]) {
      acc[gridId] = cat as PlaceCategory;
    }
    return acc;
  },
  {} as Record<string, PlaceCategory>,
);

export function mapGridIdToCategory(gridId: string): string {
  return GRID_ID_TO_CATEGORY[gridId] || gridId;
}

// ── Hook: useSocialHubs ────────────────────────────────────────────────────────

export interface UseSocialHubsProps {
  initialSelectedHubs?: Record<string, string>;
  initialHubCategories?: Record<string, string>;
  searchPath?: string;
}

export function useSocialHubs({
  initialSelectedHubs = {},
  initialHubCategories = {},
  searchPath = "/(modals)/place-search",
}: UseSocialHubsProps = {}) {
  const router = useRouter();

  const [selectedHubs, setSelectedHubs] =
    useState<Record<string, string>>(initialSelectedHubs);
  const [hubCategories, setHubCategories] =
    useState<Record<string, string>>(initialHubCategories);
  const [isExpanded, setIsExpanded] = useState(false);

  const callbackRegistered = useRef(false);

  // Refs to avoid stale closures in globalThis callback
  const hubCategoriesRef = useRef(hubCategories);
  hubCategoriesRef.current = hubCategories;
  const selectedHubsRef = useRef(selectedHubs);
  selectedHubsRef.current = selectedHubs;

  const selectedPlaceIds = useMemo(
    () => Object.keys(selectedHubs),
    [selectedHubs],
  );

  const getCountForCategory = useCallback(
    (categoryId: string) => {
      return Object.values(hubCategories).filter((c) => c === categoryId)
        .length;
    },
    [hubCategories],
  );

  const handleCategoryPress = useCallback(
    (category: HubCategory) => {
      const currentCatHubs = hubCategoriesRef.current;
      const currentSelectedHubs = selectedHubsRef.current;
      const currentCategorySelections = Object.entries(currentCatHubs)
        .filter(([, catId]) => catId === category.id)
        .map(([placeId]) => ({
          id: placeId,
          name: currentSelectedHubs[placeId] || "",
        }));

      const currentSelectedCount = Object.keys(currentSelectedHubs).length;
      const remainingSlots =
        MAX_SOCIAL_HUBS -
        currentSelectedCount +
        currentCategorySelections.length;

      // @ts-ignore
      globalThis.__favoritePlacesCallback = (
        places: { id: string; name: string }[],
      ) => {
        callbackRegistered.current = false;

        setSelectedHubs((prev) => {
          const updated = { ...prev };
          Object.entries(hubCategoriesRef.current).forEach(
            ([placeId, catId]) => {
              if (catId === category.id) {
                delete updated[placeId];
              }
            },
          );
          places.forEach((p) => {
            updated[p.id] = p.name;
          });
          return updated;
        });

        setHubCategories((prev) => {
          const updated = { ...prev };
          Object.entries(prev).forEach(([placeId, catId]) => {
            if (catId === category.id) {
              delete updated[placeId];
            }
          });
          places.forEach((p) => {
            updated[p.id] = category.id;
          });
          return updated;
        });
      };
      callbackRegistered.current = true;

      router.push({
        pathname: searchPath as any,
        params: {
          multiSelectMode: "true",
          maxSelections: String(remainingSlots),
          initialSelection: JSON.stringify(currentCategorySelections),
          categoryFilter: category.category.join(","),
          otherSelectionsCount: String(
            currentSelectedCount - currentCategorySelections.length,
          ),
        },
      });
    },
    [router, searchPath],
  );

  const handleRemoveHub = useCallback((placeId: string) => {
    setSelectedHubs((prev) => {
      const updated = { ...prev };
      delete updated[placeId];
      return updated;
    });
    setHubCategories((prev) => {
      const updated = { ...prev };
      delete updated[placeId];
      return updated;
    });
  }, []);

  const allSelectedPlaces = useMemo(
    () =>
      selectedPlaceIds.map((id) => ({
        id,
        name: selectedHubs[id] || "...",
        category: hubCategories[id] || "",
      })),
    [selectedPlaceIds, selectedHubs, hubCategories],
  );

  return {
    selectedHubs,
    hubCategories,
    selectedPlaceIds,
    isExpanded,
    setIsExpanded,
    getCountForCategory,
    handleCategoryPress,
    handleRemoveHub,
    allSelectedPlaces,
  };
}

// ── Presentational: SocialHubsContent ──────────────────────────────────────────

export interface SocialHubsContentProps {
  selectedPlaceIds: string[];
  getCountForCategory: (categoryId: string) => number;
  handleCategoryPress: (category: HubCategory) => void;
}

export function SocialHubsContent({
  selectedPlaceIds,
  getCountForCategory,
  handleCategoryPress,
}: SocialHubsContentProps) {
  const colors = useThemeColors();

  const categories: HubCategory[] = useMemo(
    () => [
      {
        id: "fitness",
        title: t("screens.home.categories.fitness.title"),
        category: ["gym"],
        color: colors.pastelBlue,
        illustration: RunningIcon,
      },
      {
        id: "university",
        title: t("screens.home.categories.university.title"),
        category: ["university"],
        color: colors.pastelBlue,
        illustration: UniversityIcon,
      },
      {
        id: "parks",
        title: t("screens.home.categories.parks.title"),
        category: ["park"],
        color: colors.pastelTeal,
        illustration: ParkIcon,
      },
      {
        id: "bars",
        title: t("screens.home.categories.nightlife.title"),
        category: ["bar"],
        color: colors.pastelPurple,
        illustration: BarsIcon,
      },
      {
        id: "nightclubs",
        title: t("screens.home.categories.nightclubs.title"),
        category: ["nightclub"],
        color: colors.pastelPurple,
        illustration: NightclubIcon,
      },
      {
        id: "stadium",
        title: t("screens.home.categories.stadium.title"),
        category: ["stadium", "event_venue"],
        color: colors.pastelPurple,
        illustration: StadiumIcon,
      },
      {
        id: "cafes",
        title: t("screens.home.categories.cafes.title"),
        category: ["cafe"],
        color: colors.pastelCocoa,
        illustration: CoffeIcon,
      },
      {
        id: "restaurants",
        title: t("screens.home.categories.restaurants.title"),
        category: ["restaurant"],
        color: colors.pastelCocoa,
        illustration: MealIcon,
      },
      {
        id: "others",
        title: t("screens.onboarding.socialHubs.others"),
        category: [],
        color: colors.pastelGreen,
        illustration: NearbyIcon,
      },
    ],
    [colors],
  );

  const renderCategory = useCallback(
    ({ item }: { item: HubCategory }) => (
      <HubCategoryCard
        category={item}
        selectedCount={getCountForCategory(item.id)}
        onPress={() => handleCategoryPress(item)}
      />
    ),
    [getCountForCategory, handleCategoryPress],
  );

  const keyExtractor = useCallback((item: HubCategory) => item.id, []);

  return (
    <>
      <Animated.View entering={FadeInDown.delay(100).springify()}>
        <ThemedText
          style={[typography.heading, styles.title, { color: colors.text }]}
        >
          {t("screens.onboarding.socialHubs.title")}
        </ThemedText>
        <ThemedText
          style={[
            typography.body,
            styles.subtitle,
            { color: colors.textSecondary },
          ]}
        >
          {t("screens.onboarding.socialHubs.subtitle")}
        </ThemedText>
        <ThemedText
          style={[
            typography.caption,
            styles.counter,
            { color: colors.textSecondary },
          ]}
        >
          {t("screens.onboarding.favoritePlaces.selectionHint", {
            current: selectedPlaceIds.length,
            max: MAX_SOCIAL_HUBS,
          })}
        </ThemedText>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(200).springify()}
        style={styles.gridContainer}
      >
        <FlatList
          data={categories}
          keyExtractor={keyExtractor}
          renderItem={renderCategory}
          numColumns={2}
          columnWrapperStyle={styles.row}
          scrollEnabled={false}
          contentContainerStyle={styles.gridContent}
        />
      </Animated.View>
    </>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screenContent: {
    paddingBottom: spacing.xxl * 5,
  },
  title: {
    marginBottom: spacing.xs,
  },
  subtitle: {
    marginBottom: spacing.xs,
  },
  counter: {
    textAlign: "right",
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  gridContainer: {},
  gridContent: {
    gap: spacing.sm,
  },
  row: {
    gap: spacing.sm,
  },
});

export { styles as socialHubsStyles };
