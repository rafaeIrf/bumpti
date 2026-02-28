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
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { HubCategory, HubCategoryCard } from "@/components/hub-category-card";
import { MultiSelectSheet } from "@/components/multi-select-sheet";
import { ScreenBottomBar } from "@/components/screen-bottom-bar";
import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { useOnboardingFlow } from "@/hooks/use-onboarding-flow";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useScreenTracking } from "@/modules/analytics";
import { t } from "@/modules/locales";
import { onboardingActions } from "@/modules/store/slices/onboardingActions";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

const MAX_SOCIAL_HUBS = 6;

export default function SocialHubsScreen() {
  const { completeCurrentStep } = useOnboardingFlow();
  const colors = useThemeColors();
  const router = useRouter();

  useScreenTracking({
    screenName: "onboarding_social_hubs",
    params: { step_name: "social_hubs" },
  });

  // Map of placeId -> placeName for all selected hubs
  const [selectedHubs, setSelectedHubs] = useState<Record<string, string>>({});
  // Track which category each hub belongs to
  const [hubCategories, setHubCategories] = useState<Record<string, string>>(
    {},
  );

  // Register callback ref to receive selections from place-search
  const callbackRegistered = useRef(false);

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
      // Current selections for this category
      const currentCategorySelections = Object.entries(hubCategories)
        .filter(([, catId]) => catId === category.id)
        .map(([placeId]) => ({
          id: placeId,
          name: selectedHubs[placeId] || "",
        }));

      const remainingSlots =
        MAX_SOCIAL_HUBS -
        selectedPlaceIds.length +
        currentCategorySelections.length;

      // Register callback to receive selections from place-search
      // @ts-ignore
      globalThis.__favoritePlacesCallback = (
        places: { id: string; name: string }[],
      ) => {
        callbackRegistered.current = false;

        setSelectedHubs((prev) => {
          const updated = { ...prev };
          // Remove old selections for this category
          Object.entries(hubCategories).forEach(([placeId, catId]) => {
            if (catId === category.id) {
              delete updated[placeId];
            }
          });
          // Add new selections
          places.forEach((p) => {
            updated[p.id] = p.name;
          });
          return updated;
        });

        setHubCategories((prev) => {
          const updated = { ...prev };
          // Remove old category mappings
          Object.entries(prev).forEach(([placeId, catId]) => {
            if (catId === category.id) {
              delete updated[placeId];
            }
          });
          // Add new mappings
          places.forEach((p) => {
            updated[p.id] = category.id;
          });
          return updated;
        });
      };
      callbackRegistered.current = true;

      router.push({
        pathname: "/(onboarding)/place-search",
        params: {
          multiSelectMode: "true",
          maxSelections: String(remainingSlots),
          initialSelection: JSON.stringify(currentCategorySelections),
          categoryFilter: category.category.join(","),
          otherSelectionsCount: String(
            selectedPlaceIds.length - currentCategorySelections.length,
          ),
        },
      });
    },
    [hubCategories, selectedHubs, selectedPlaceIds.length, router],
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

  const handleContinue = useCallback(() => {
    if (selectedPlaceIds.length > 0) {
      onboardingActions.setSocialHubs(selectedPlaceIds);
    }
    completeCurrentStep("social-hubs");
  }, [selectedPlaceIds, completeCurrentStep]);

  const allSelectedPlaces = useMemo(
    () =>
      selectedPlaceIds.map((id) => ({
        id,
        name: selectedHubs[id] || "...",
        category: hubCategories[id] || "",
      })),
    [selectedPlaceIds, selectedHubs, hubCategories],
  );

  const [isExpanded, setIsExpanded] = useState(false);

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
    <BaseTemplateScreen
      hasStackHeader
      useSafeArea={false}
      contentContainerStyle={styles.screenContent}
      BottomBar={
        <ScreenBottomBar
          variant="single"
          primaryLabel={t("common.continue")}
          onPrimaryPress={handleContinue}
          primaryDisabled={selectedPlaceIds.length === 0}
          topContent={
            selectedPlaceIds.length > 0 ? (
              <MultiSelectSheet
                selectedItems={allSelectedPlaces}
                getItemId={(item) => item.id}
                getItemLabel={(item) => item.name}
                isExpanded={isExpanded}
                onToggleExpanded={() => setIsExpanded(!isExpanded)}
                onRemoveItem={(item) => handleRemoveHub(item.id)}
              />
            ) : undefined
          }
        />
      }
    >
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
    </BaseTemplateScreen>
  );
}

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
