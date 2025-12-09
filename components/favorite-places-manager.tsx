import { SearchIcon } from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { spacing, typography } from "@/constants/theme";
import { useCachedLocation } from "@/hooks/use-cached-location";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { PlacesByCategory } from "@/modules/places/api";
import { PlaceCategory } from "@/modules/places/types";
import { useGetSuggestedPlacesQuery } from "@/modules/places/placesApi";
import { logger } from "@/utils/logger";
import { skipToken } from "@reduxjs/toolkit/query";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

const CATEGORY_LABELS: Record<PlaceCategory, string> = {
  bars: "Bares",
  nightlife: "Baladas",
  cafes: "Cafés",
  restaurants: "Restaurantes",
  fitness: "Academias",
  university: "Universidades",
  parks: "Parques",
};

const CATEGORIES: PlaceCategory[] = [
  "bars",
  "nightlife",
  "cafes",
  "restaurants",
  "fitness",
  "university",
  "parks",
];

const MAX_SELECTIONS = 12;

export interface UseFavoritePlacesProps {
  initialSelectedIds?: string[];
  initialPlacesMap?: Record<string, string>;
}

export function useFavoritePlaces({
  initialSelectedIds = [],
  initialPlacesMap = {},
}: UseFavoritePlacesProps) {
  const { location: userLocation, loading: locationLoading } =
    useCachedLocation();

  // UI State
  const [isExpanded, setIsExpanded] = React.useState(false);

  // Selection State
  const [selectedPlaceIds, setSelectedPlaceIds] =
    React.useState<string[]>(initialSelectedIds);
  const [placesMap, setPlacesMap] =
    React.useState<Record<string, string>>(initialPlacesMap);

  // API State
  const {
    data: suggestedPlacesResponse,
    isFetching: isLoadingPlaces,
    isError,
  } = useGetSuggestedPlacesQuery(
    userLocation
      ? {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          categories: CATEGORIES,
        }
      : skipToken
  );

  React.useEffect(() => {
    if (isError) {
      logger.error("[FavoritePlaces] Error fetching places via RTK Query");
    }
  }, [isError]);

  const suggestedPlaces = React.useMemo(
    () => suggestedPlacesResponse?.data ?? [],
    [suggestedPlacesResponse?.data]
  );

  // Handle places selected from search screen
  const handlePlacesFromSearch = React.useCallback(
    (places: { id: string; name: string }[]) => {
      const newIds = places.map((p) => p.id);
      const newPlacesMap = places.reduce(
        (acc, p) => ({ ...acc, [p.id]: p.name }),
        {} as Record<string, string>
      );

      setSelectedPlaceIds((prev) => Array.from(new Set([...prev, ...newIds])));
      setPlacesMap((prev) => ({ ...prev, ...newPlacesMap }));

      // Ensure sheet stays collapsed when returning from search
      setIsExpanded(false);

      logger.log(
        "[FavoritePlaces] Updated selection:",
        places.length,
        "places"
      );
    },
    []
  );

  const togglePlace = (placeId: string, placeName: string) => {
    const isSelected = selectedPlaceIds.includes(placeId);

    if (isSelected) {
      setSelectedPlaceIds((prev) => prev.filter((id) => id !== placeId));
      setPlacesMap((prev) => {
        const { [placeId]: _, ...rest } = prev;
        return rest;
      });
    } else if (selectedPlaceIds.length < MAX_SELECTIONS) {
      setSelectedPlaceIds((prev) => [...prev, placeId]);
      setPlacesMap((prev) => ({ ...prev, [placeId]: placeName }));
    }
  };

  const removePlace = (item: { id: string }) => {
    setSelectedPlaceIds((prev) => prev.filter((id) => id !== item.id));
    setPlacesMap((prev) => {
      const { [item.id]: _, ...rest } = prev;
      return rest;
    });
  };

  const handleOpenSearch = () => {
    // Store callback globally (Expo Router limitation - can't pass functions via params)
    // @ts-ignore
    globalThis.__favoritePlacesCallback = handlePlacesFromSearch;

    const initialSelection = selectedPlaceIds
      .filter((id) => placesMap[id])
      .map((id) => ({ id, name: placesMap[id] }));

    router.push({
      pathname: "/(modals)/place-search",
      params: {
        multiSelectMode: "true",
        initialSelection: JSON.stringify(initialSelection),
      },
    });
  };

  const getPlacesByCategory = (category: PlaceCategory) => {
    return suggestedPlaces.find((c) => c.category === category)?.places || [];
  };

  return {
    selectedPlaceIds,
    placesMap,
    isExpanded,
    setIsExpanded,
    togglePlace,
    removePlace,
    handleOpenSearch,
    suggestedPlaces,
    isLoadingPlaces,
    locationLoading,
    getPlacesByCategory,
  };
}

interface FavoritePlacesContentProps {
  title?: string;
  subtitle?: string;
  selectedPlaceIds: string[];
  togglePlace: (id: string, name: string) => void;
  handleOpenSearch: () => void;
  suggestedPlaces: PlacesByCategory[];
  isLoadingPlaces: boolean;
  locationLoading: boolean;
  getPlacesByCategory: (category: PlaceCategory) => any[];
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
}

export function FavoritePlacesContent({
  title,
  subtitle,
  selectedPlaceIds,
  togglePlace,
  handleOpenSearch,
  isLoadingPlaces,
  locationLoading,
  getPlacesByCategory,
  isExpanded,
  setIsExpanded,
}: FavoritePlacesContentProps) {
  const colors = useThemeColors();

  return (
    <Pressable
      style={styles.container}
      onPress={() => isExpanded && setIsExpanded(false)}
      disabled={!isExpanded}
    >
      <ThemedView style={styles.innerContainer}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText style={styles.title}>
            {title || t("screens.onboarding.favoritePlaces.title")}
          </ThemedText>
          <ThemedText
            style={[styles.subtitle, { color: colors.textSecondary }]}
          >
            {subtitle || t("screens.onboarding.favoritePlaces.subtitle")}
          </ThemedText>
        </View>

        {/* Search Input */}
        <Pressable
          onPress={handleOpenSearch}
          style={({ pressed }) => [
            styles.searchButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && styles.searchButtonPressed,
          ]}
        >
          <SearchIcon width={18} height={18} color={colors.textSecondary} />
          <ThemedText
            style={[
              styles.searchPlaceholder,
              { color: colors.textSecondary },
            ]}
          >
            {t("screens.onboarding.favoritePlaces.searchPlaceholder")}
          </ThemedText>
        </Pressable>

        {/* Suggested Places by Category */}
        {isLoadingPlaces || locationLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <ThemedText
              style={[styles.loadingText, { color: colors.textSecondary }]}
            >
              {t("common.loading")}
            </ThemedText>
          </View>
        ) : (
          <ScrollView
            style={styles.categoriesScroll}
            contentContainerStyle={styles.categoriesContent}
            showsVerticalScrollIndicator={false}
          >
            {CATEGORIES.map((category) => {
              const places = getPlacesByCategory(category);
              if (places.length === 0) return null;

              return (
                <View key={category} style={styles.categorySection}>
                  {/* Category Label */}
                  <ThemedText
                    style={[
                      styles.categoryLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {CATEGORY_LABELS[category]}
                  </ThemedText>

                  {/* Place Cards */}
                  <View style={styles.placeCards}>
                    {places.map((place) => {
                      const isSelected = selectedPlaceIds.includes(
                        place.placeId
                      );
                      return (
                        <Pressable
                          key={place.placeId}
                          onPress={() =>
                            togglePlace(place.placeId, place.name)
                          }
                          style={({ pressed }) => [
                            styles.placeCard,
                            {
                              backgroundColor: isSelected
                                ? colors.accent
                                : colors.surface,
                              borderColor: isSelected
                                ? colors.accent
                                : colors.border,
                              borderWidth: 1,
                            },
                            pressed && styles.placeCardPressed,
                          ]}
                        >
                          <ThemedText style={styles.placeCardText}>
                            {place.name}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
    paddingTop: spacing.lg,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.heading,
    fontSize: 28,
    marginBottom: spacing.sm,
    color: "#FFFFFF",
  },
  subtitle: {
    fontFamily: "Poppins",
    fontWeight: "400",
    fontSize: 15,
    lineHeight: 22,
  },
  searchButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  searchButtonPressed: {
    opacity: 0.7,
  },
  searchPlaceholder: {
    ...typography.body,
  },
  categoriesScroll: {
    flex: 1,
  },
  categoriesContent: {
    paddingBottom: spacing.md,
  },
  categorySection: {
    marginBottom: spacing.lg,
  },
  categoryLabel: {
    fontFamily: "Poppins",
    fontWeight: "600",
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    paddingHorizontal: 2,
  },
  placeCards: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  placeCard: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
  },
  placeCardPressed: {
    opacity: 0.7,
  },
  placeCardText: {
    fontFamily: "Poppins",
    fontWeight: "500",
    fontSize: 14,
    color: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: spacing.xxl,
    gap: spacing.md,
  },
  loadingText: {
    fontFamily: "Poppins",
    fontWeight: "400",
    fontSize: 15,
  },
});
