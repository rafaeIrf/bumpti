import { ArrowLeftIcon, MapPinIcon, SearchIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { useCustomBottomSheet } from "@/components/BottomSheetProvider/hooks";
import { CategoryFilterList } from "@/components/category-filter-list";
import {
  ConnectionBottomSheet,
  VenueState,
} from "@/components/connection-bottom-sheet";
import { PlaceCard } from "@/components/place-card";
import { PlaceLoadingSkeleton } from "@/components/place-loading-skeleton";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import Button from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useCachedLocation } from "@/hooks/use-cached-location";
import { useFavoritePlacesList } from "@/hooks/use-favorite-places-list";
import { usePlaceDetailsSheet } from "@/hooks/use-place-details-sheet";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import {
  useGetNearbyPlacesQuery,
  useGetPlacesByFavoritesQuery,
  useGetTrendingPlacesQuery,
} from "@/modules/places/placesApi";
import {
  Place,
  PLACE_VIBES,
  PlaceCategory,
  PlaceVibe,
} from "@/modules/places/types";
import { enterPlace } from "@/modules/presence/api";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet } from "react-native";
import Animated, { FadeInDown, FadeOut, Layout } from "react-native-reanimated";

const allCategories: PlaceCategory[] = [
  "bar",
  "nightclub",
  "cafe",
  "restaurant",
  "gym",
  "fitness_centre",
  "university",
  "college",
  "park",
  "museum",
  "stadium",
  "library",
  "sports_centre",
  "community_centre",
  "events_venue",
  "club",
];

const getRandomVibes = (): PlaceVibe[] => {
  const shuffled = [...PLACE_VIBES].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 3);
};

export default function CategoryResultsScreen() {
  const colors = useThemeColors();
  const params = useLocalSearchParams();
  const categoryName = params.categoryName as string;
  const category = params.category as string[];
  const favoritesMode = params.favorites === "true";
  const trendingMode = params.trending === "true";
  const bottomSheet = useCustomBottomSheet();
  const [activeFilter, setActiveFilter] = useState<PlaceCategory | "all">(
    "all"
  );

  // Use cached location hook
  const { location: userLocation, loading: locationLoading } =
    useCachedLocation();

  // Trending places query
  const { data: trendingData, isLoading: trendingLoading } =
    useGetTrendingPlacesQuery(
      {
        lat: userLocation?.latitude,
        lng: userLocation?.longitude,
      },
      {
        skip: !trendingMode,
      }
    );

  // Use RTK Query hook - only runs when userLocation is available and not in trending mode
  const nearbyMode = params.nearby === "true";
  const communityFavoritesMode = params.communityFavorites === "true";

  // When nearby or communityFavorites mode is active, we fetch ALL categories
  const targetCategory = nearbyMode ? allCategories : category;

  const shouldFetchNearby =
    !favoritesMode &&
    !trendingMode &&
    !communityFavoritesMode &&
    !!userLocation &&
    !!userLocation.city &&
    (!!targetCategory || nearbyMode);

  const { data: placesData, isLoading } = useGetNearbyPlacesQuery(
    {
      latitude: userLocation?.latitude ?? 0,
      longitude: userLocation?.longitude ?? 0,
      category: targetCategory,
    },
    {
      skip: !shouldFetchNearby, // skip when favorites, trending or missing location/category/city
    }
  );

  // Fetch places sorted by favorites count (community favorites mode)
  const shouldFetchCommunityFavorites =
    communityFavoritesMode && !!userLocation && !!userLocation.city;

  const { data: communityFavoritesData, isLoading: communityFavoritesLoading } =
    useGetPlacesByFavoritesQuery(
      {
        latitude: userLocation?.latitude ?? 0,
        longitude: userLocation?.longitude ?? 0,
        category: targetCategory,
      },
      {
        skip: !shouldFetchCommunityFavorites,
      }
    );

  // ... (lines 138-176 unchanged)

  const { favoritePlacesData, favoritePlacesLoading, favoriteQueryArg } =
    useFavoritePlacesList(favoritesMode);
  const { showPlaceDetails, favoriteIds, handleToggle } = usePlaceDetailsSheet({
    queryArg: favoriteQueryArg,
  });

  // Transform API results to Place format
  const places: Place[] = useMemo(() => {
    if (trendingMode) {
      return (
        trendingData?.places?.map((place: any) => ({
          placeId: place.place_id,
          name: place.name,
          type: place.types?.[0] || undefined,
          types: place.types || [],
          distance: place.distance || 0,
          formattedAddress: place.formattedAddress || "",
          latitude: place.latitude,
          longitude: place.longitude,
          active_users: place.active_users,
          review: place.review || {
            average: place.rating || 0,
            count: place.user_ratings_total || 0,
            tags: getRandomVibes(),
          },
        })) || []
      );
    }
    if (favoritesMode) {
      return favoritePlacesData;
    }
    if (communityFavoritesMode) {
      return communityFavoritesData || [];
    }
    console.log(placesData);
    return placesData || [];
  }, [
    trendingMode,
    favoritesMode,
    communityFavoritesMode,
    trendingData,
    favoritePlacesData,
    communityFavoritesData,
    placesData,
  ]);

  // Filter places based on active filter
  const filteredPlaces = useMemo(() => {
    if (activeFilter === "all") return places;
    return places.filter((place: any) => {
      // Check if the place type matches the active filter or if it's in the types array
      const type = place.type || (place.types && place.types[0]);
      return (
        type === activeFilter ||
        place.types?.includes(activeFilter) ||
        // Fallback: check if the active filter string is part of the place type string
        (typeof type === "string" && type.includes(activeFilter))
      );
    });
  }, [places, activeFilter]);

  // Only show categories that have items in the list
  const availableCategories = useMemo(() => {
    return allCategories.filter((category) =>
      places.some((place) => place.types?.includes(category))
    );
  }, [places]);

  const shouldShowFilters =
    (nearbyMode || trendingMode || favoritesMode || communityFavoritesMode) &&
    availableCategories.filter((c) => c !== "all").length > 1;

  // ... existing code ...

  const handleConnectionBottomSheet = useCallback(
    (place: Place, venueState: VenueState) => {
      bottomSheet?.expand({
        content: () => (
          <ConnectionBottomSheet
            venueName={place.name}
            venueState={venueState}
            onConnect={() => {
              bottomSheet.close();
              router.push({
                pathname: "/(modals)/place-people",
                params: {
                  placeId: place.placeId,
                  placeName: place.name,
                  distance: "1.2 km", // TODO: Calculate real distance
                },
              });
            }}
            onCancel={() => {
              bottomSheet.close();
            }}
            onClose={() => {
              bottomSheet.close();
            }}
          />
        ),
        draggable: true,
      });
    },
    [bottomSheet]
  );

  const handlePlaceClick = useCallback(
    async (place: Place) => {
      if (!bottomSheet) return;

      if (!userLocation?.latitude || !userLocation?.longitude) {
        handleConnectionBottomSheet(place, "locked");
        return;
      }

      const result = await enterPlace({
        placeId: place.placeId,
        userLat: userLocation.latitude,
        userLng: userLocation.longitude,
        placeLat: place.latitude,
        placeLng: place.longitude,
      });

      if (!result) {
        handleConnectionBottomSheet(place, "locked");
        return;
      }

      router.push({
        pathname: "/(modals)/place-people",
        params: {
          placeId: place.placeId,
          placeName: place.name,
          distance: `${place.distance} km`, // TODO: Calculate real distance
        },
      });
    },
    [
      bottomSheet,
      userLocation?.latitude,
      userLocation?.longitude,
      handleConnectionBottomSheet,
    ]
  );

  const handleOpenSearch = () => {
    router.push("/main/place-search");
  };

  const renderEmptyState = () => (
    <Animated.View entering={FadeInDown.delay(0).springify()}>
      <ThemedView style={styles.emptyContainer}>
        <ThemedView
          style={[
            styles.emptyIcon,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <MapPinIcon width={48} height={48} color={colors.textSecondary} />
        </ThemedView>
        <ThemedText
          style={[
            styles.emptyTitle,
            { ...typography.subheading, color: colors.text },
          ]}
        >
          {t("screens.categoryResults.emptyTitle")}
        </ThemedText>
        <ThemedText
          style={[
            styles.emptyDescription,
            { ...typography.body, color: colors.textSecondary },
          ]}
        >
          {t("screens.categoryResults.emptyDescription")}
        </ThemedText>
        <Pressable
          onPress={() => router.back()}
          style={[styles.emptyButton, { backgroundColor: colors.accent }]}
        >
          <ThemedText style={[styles.emptyButtonText, { color: "#000" }]}>
            {t("screens.categoryResults.tryAnother")}
          </ThemedText>
        </Pressable>
      </ThemedView>
    </Animated.View>
  );
  const renderPlaceItem = useCallback(
    ({ item, index }: { item: Place; index: number }) => {
      const placeData = {
        id: item.placeId,
        name: item.name,
        address: item.formattedAddress ?? "",
        distance: item.distance,
        activeUsers: (item as any).active_users || 0,
        tag: item.types?.[0] || undefined,
        review: item.review,
      };

      return (
        <Animated.View
          entering={FadeInDown.delay(index * 40).springify()}
          exiting={FadeOut.duration(220)}
          layout={Layout.springify()}
          style={styles.placeCardWrapper}
        >
          <PlaceCard
            place={placeData}
            onPress={() => handlePlaceClick(item)}
            onInfoPress={() => showPlaceDetails(item)}
            isFavorite={favoriteIds.has(item.placeId)}
            onToggleFavorite={() => handleToggle(item.placeId)}
          />
        </Animated.View>
      );
    },
    [handlePlaceClick, showPlaceDetails, favoriteIds, handleToggle]
  );

  const listFooterComponent = useMemo(
    () => (
      <ThemedView style={styles.footerContainer}>
        <ThemedText
          style={[styles.footerCopy, { color: colors.textSecondary }]}
        >
          {t("screens.categoryResults.searchFallback")}
        </ThemedText>
        <Button
          onPress={handleOpenSearch}
          variant="default"
          size="sm"
          leftIcon={<SearchIcon width={16} height={16} color={colors.text} />}
          label={t("screens.categoryResults.searchCta")}
        />
      </ThemedView>
    ),
    [colors.accent, colors.textSecondary, handleOpenSearch, t]
  );

  let loadingState: boolean;
  if (trendingMode) {
    loadingState = trendingLoading;
  } else if (favoritesMode) {
    loadingState = favoritePlacesLoading;
  } else if (communityFavoritesMode) {
    loadingState = locationLoading || communityFavoritesLoading;
  } else {
    loadingState = locationLoading || isLoading;
  }

  const isLoadingState = useMemo(() => loadingState, [loadingState]);

  return (
    <BaseTemplateScreen
      TopHeader={
        <ThemedView>
          <ScreenToolbar
            leftAction={{
              icon: ArrowLeftIcon,
              onClick: () => router.back(),
              ariaLabel: t("common.back"),
            }}
            title={categoryName || ""}
            rightActions={
              favoritesMode || trendingMode || communityFavoritesMode
                ? []
                : [
                    {
                      icon: SearchIcon,
                      onClick: handleOpenSearch,
                      ariaLabel: t("common.search"),
                      color: colors.icon,
                    },
                  ]
            }
          />
        </ThemedView>
      }
    >
      <ThemedView>
        {(() => {
          if (isLoadingState) {
            return <PlaceLoadingSkeleton count={6} />;
          }

          if (places.length === 0) {
            return renderEmptyState();
          }

          return (
            <>
              {shouldShowFilters && (
                <CategoryFilterList
                  categories={availableCategories}
                  selectedCategory={activeFilter}
                  onSelect={setActiveFilter}
                />
              )}
              <FlatList
                data={filteredPlaces}
                keyExtractor={(item) => item.placeId}
                renderItem={renderPlaceItem}
                contentContainerStyle={styles.listContainer}
                showsVerticalScrollIndicator={false}
                ListFooterComponent={
                  favoritesMode || trendingMode
                    ? undefined
                    : listFooterComponent
                }
              />
            </>
          );
        })()}
      </ThemedView>
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  headerSubtitle: {
    fontSize: 14,
    marginTop: spacing.sm,
  },
  // Empty state
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
    minHeight: 400,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  emptyDescription: {
    textAlign: "center",
    maxWidth: 320,
    marginBottom: spacing.lg,
  },
  emptyButton: {
    paddingVertical: spacing.sm + 4,
    borderRadius: 999,
  },
  emptyButtonText: {
    fontWeight: "600",
  },
  // Places list
  listContainer: {
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  placesCount: {
    fontSize: 14,
  },
  placeCardWrapper: {
    position: "relative",
  },
  footerContainer: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: 16,
    alignItems: "center",
    gap: spacing.md,
  },
  footerCopy: {
    textAlign: "center",
    ...typography.caption,
  },
  footerButtonLabel: {
    fontWeight: "600",
    color: "#000",
  },
});
