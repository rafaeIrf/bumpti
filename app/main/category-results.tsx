import {
  ArrowLeftIcon,
  SearchIcon,
  SlidersHorizontalIcon,
} from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { useCustomBottomSheet } from "@/components/BottomSheetProvider/hooks";
import {
  CategoryFilterList,
  FilterChip,
} from "@/components/category-filter-list";
import { LocationPermissionState } from "@/components/location-permission-state";
import { PlaceCard } from "@/components/place-card";
import { PlaceLoadingSkeleton } from "@/components/place-loading-skeleton";
import { PlacesEmptyState } from "@/components/places-empty-state";
import {
  PlacesFilterBottomSheet,
  SortOption,
} from "@/components/places-filter-bottom-sheet";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import Button from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useCachedLocation } from "@/hooks/use-cached-location";
import { useFavoritePlacesList } from "@/hooks/use-favorite-places-list";
import { useLocationPermission } from "@/hooks/use-location-permission";
import { usePlaceClick } from "@/hooks/use-place-click";
import { usePlaceDetailsSheet } from "@/hooks/use-place-details-sheet";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { shouldHaveMorePages } from "@/modules/places/nearby-pagination";
import { getEffectiveSortBy } from "@/modules/places/nearby-sort";
import {
  placesApi,
  useGetNearbyPlacesQuery,
  useGetPlacesByFavoritesQuery,
  useGetRankedPlacesQuery,
  useGetTrendingPlacesQuery,
} from "@/modules/places/placesApi";
import {
  Place,
  PLACE_VIBES,
  PlaceCategory,
  PlaceVibe,
} from "@/modules/places/types";
import { useAppSelector } from "@/modules/store/hooks";
import { router, useLocalSearchParams } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FlatList, StyleSheet } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

const PAGE_SIZE = 20;
const MAX_RESULTS = 60;
const MAX_PAGES = Math.ceil(MAX_RESULTS / PAGE_SIZE);

export default function CategoryResultsScreen() {
  const colors = useThemeColors();
  const params = useLocalSearchParams();
  const bottomSheet = useCustomBottomSheet();
  const categoryName =
    typeof params.categoryName === "string" ? params.categoryName : "";
  const categoryParam = params.category;
  const category = useMemo<PlaceCategory[]>(() => {
    if (Array.isArray(categoryParam)) {
      return categoryParam as PlaceCategory[];
    }
    if (typeof categoryParam === "string" && categoryParam.length > 0) {
      return categoryParam
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean) as PlaceCategory[];
    }
    return [];
  }, [categoryParam]);
  const favoritesMode = params.favorites === "true";
  const trendingMode = params.trending === "true";
  const nearbyMode = params.nearby === "true";
  const communityFavoritesMode = params.communityFavorites === "true";
  const mostFrequentMode = params.mostFrequent === "true";
  const { handlePlaceClick } = usePlaceClick();
  const insets = useSafeAreaInsets();
  const {
    hasPermission: hasLocationPermission,
    isLoading: permissionLoading,
    canAskAgain,
    request: requestLocationPermission,
    openSettings,
  } = useLocationPermission();
  const [activeFilter, setActiveFilter] = useState<PlaceCategory | "all">(
    "all"
  );
  const [sortBy, setSortBy] = useState<SortOption>("relevance");
  const [minRating, setMinRating] = useState<number | null>(null);
  const [rankingFilter, setRankingFilter] = useState<"month" | "general">(
    "month"
  );
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [lastAvailableCategories, setLastAvailableCategories] = useState<
    PlaceCategory[]
  >([]);
  const listRef = useRef<FlatList<Place>>(null);
  const lastAppendedPageRef = useRef(1);
  const endReachedDuringMomentumRef = useRef(true);
  const [resetKey, setResetKey] = useState("");
  const hasUserScrolledSinceChangeRef = useRef(false);
  const lastCategoryKeyRef = useRef("");

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

  const targetCategory = useMemo<PlaceCategory[]>(() => {
    if (nearbyMode) {
      return activeFilter === "all" ? allCategories : [activeFilter];
    }
    return category;
  }, [activeFilter, category, nearbyMode]);

  const shouldFetchNearby =
    !favoritesMode &&
    !trendingMode &&
    !communityFavoritesMode &&
    !mostFrequentMode &&
    !!userLocation &&
    !!userLocation.city &&
    targetCategory.length > 0;

  // Fetch for mostFrequent mode with ranking
  const shouldFetchMostFrequent =
    mostFrequentMode && !!userLocation && !!userLocation.city;

  const isPaginatedMode = shouldFetchNearby;
  const effectiveSortBy = getEffectiveSortBy(nearbyMode, sortBy);

  const cachedPlacesForKey = useAppSelector((state) => {
    const result = placesApi.endpoints.getNearbyPlaces.select({
      latitude: userLocation?.latitude ?? 0,
      longitude: userLocation?.longitude ?? 0,
      category: targetCategory,
      page: 1,
      pageSize: PAGE_SIZE,
      sortBy: effectiveSortBy,
      minRating,
    })(state);
    return result?.data ?? [];
  });
  const cachedPagesCount =
    cachedPlacesForKey.length > 0
      ? Math.ceil(cachedPlacesForKey.length / PAGE_SIZE)
      : 0;

  const paginationKey = useMemo(() => {
    if (!isPaginatedMode) return "";
    const categoryKey = targetCategory.join(",");
    return `${nearbyMode ? "nearby" : "category"}_${
      userLocation?.latitude ?? 0
    }_${userLocation?.longitude ?? 0}_${categoryKey}_${effectiveSortBy}_${
      minRating ?? "all"
    }`;
  }, [
    isPaginatedMode,
    targetCategory,
    nearbyMode,
    userLocation?.latitude,
    userLocation?.longitude,
    effectiveSortBy,
    minRating,
  ]);

  const isResettingKey = paginationKey !== resetKey;
  const activePage = isResettingKey ? 1 : page;
  const queryPage =
    isResettingKey && cachedPagesCount > 0 ? cachedPagesCount : activePage;

  const nearbyQueryArgs = useMemo(
    () => ({
      latitude: userLocation?.latitude ?? 0,
      longitude: userLocation?.longitude ?? 0,
      category: targetCategory,
      page: queryPage,
      pageSize: PAGE_SIZE,
      sortBy: effectiveSortBy,
      minRating,
    }),
    [
      minRating,
      queryPage,
      effectiveSortBy,
      targetCategory,
      userLocation?.latitude,
      userLocation?.longitude,
    ]
  );

  const { data: nearbyPlacesData, isFetching: nearbyFetching } =
    useGetNearbyPlacesQuery(nearbyQueryArgs, {
      skip: !shouldFetchNearby,
    });

  // Fetch places sorted by favorites count (community favorites mode)
  const shouldFetchCommunityFavorites =
    communityFavoritesMode && !!userLocation && !!userLocation.city;

  const { data: communityFavoritesData, isLoading: communityFavoritesLoading } =
    useGetPlacesByFavoritesQuery(
      {
        latitude: userLocation?.latitude ?? 0,
        longitude: userLocation?.longitude ?? 0,
      },
      {
        skip: !shouldFetchCommunityFavorites,
      }
    );

  // Fetch for mostFrequent mode with ranking using dedicated RPC
  const rankByOption = rankingFilter === "month" ? "monthly" : "total";
  const rankedQueryArgs = useMemo(
    () => ({
      latitude: userLocation?.latitude ?? 0,
      longitude: userLocation?.longitude ?? 0,
      rankBy: rankByOption as "monthly" | "total",
    }),
    [userLocation?.latitude, userLocation?.longitude, rankByOption]
  );

  const { data: mostFrequentData, isFetching: mostFrequentFetching } =
    useGetRankedPlacesQuery(rankedQueryArgs, {
      skip: !shouldFetchMostFrequent,
    });

  const paginatedPlaces = useMemo<Place[]>(
    () => nearbyPlacesData ?? [],
    [nearbyPlacesData]
  );

  useEffect(() => {
    if (!isPaginatedMode) return;
    setPage(cachedPagesCount > 0 ? cachedPagesCount : 1);
    setHasMore(true);
    lastAppendedPageRef.current = 0;
    endReachedDuringMomentumRef.current = true;
    hasUserScrolledSinceChangeRef.current = false;
    const categoryKey = targetCategory.join(",");
    if (lastCategoryKeyRef.current !== categoryKey) {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
      lastCategoryKeyRef.current = categoryKey;
    }
    setResetKey(paginationKey);
  }, [cachedPagesCount, isPaginatedMode, paginationKey, targetCategory]);

  useEffect(() => {
    if (!isPaginatedMode || !shouldFetchNearby) return;
    if (paginatedPlaces.length === 0) return;
    if (paginationKey !== resetKey && activePage !== 1) return;
    const fetchedCount = Math.max(
      0,
      paginatedPlaces.length - (activePage - 1) * PAGE_SIZE
    );
    setHasMore(
      shouldHaveMorePages({
        page: activePage,
        pageSize: PAGE_SIZE,
        totalLoaded: activePage >= 2 ? paginatedPlaces.length : fetchedCount,
        maxPages: MAX_PAGES,
      })
    );
    lastAppendedPageRef.current = activePage;
  }, [
    isPaginatedMode,
    minRating,
    activePage,
    paginationKey,
    resetKey,
    shouldFetchNearby,
    sortBy,
    targetCategory,
    userLocation?.latitude,
    userLocation?.longitude,
    paginatedPlaces,
  ]);

  const isPaginatedFetching = shouldFetchNearby ? nearbyFetching : false;
  const isFetchingMore =
    isPaginatedMode && activePage > 1 && isPaginatedFetching;
  const isPaginatedInitialLoading =
    isPaginatedMode &&
    activePage === 1 &&
    isPaginatedFetching &&
    paginatedPlaces.length === 0;

  const { favoritePlacesData, favoritePlacesLoading, favoriteQueryArg } =
    useFavoritePlacesList(favoritesMode);
  const { showPlaceDetails, favoriteIds, handleToggle } = usePlaceDetailsSheet({
    queryArg: favoriteQueryArg,
  });

  // Transform API results to Place format
  const places: Place[] = useMemo(() => {
    if (trendingMode) {
      return (
        trendingData?.places?.map((place: Place) => ({
          ...place,
          review: place.review || {
            average: 0,
            count: 0,
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
    if (mostFrequentMode) {
      return mostFrequentData || [];
    }
    return paginatedPlaces;
  }, [
    trendingMode,
    favoritesMode,
    communityFavoritesMode,
    mostFrequentMode,
    trendingData,
    favoritePlacesData,
    communityFavoritesData,
    mostFrequentData,
    paginatedPlaces,
  ]);

  // Filter places based on active filter
  const filteredPlaces = useMemo(() => {
    let result = places;

    // In favorites mode, exclude places that were optimistically unfavorited
    if (favoritesMode) {
      result = result.filter((p) => favoriteIds.has(p.placeId));
    }

    if (activeFilter !== "all") {
      result = result.filter((place) => {
        const type = place.types?.[0];
        return (
          type === activeFilter ||
          place.types?.includes(activeFilter) ||
          (typeof type === "string" && type.includes(activeFilter))
        );
      });
    }

    return result;
  }, [places, activeFilter, favoriteIds, favoritesMode]);

  // Only show categories that have items in the list
  const availableCategories = useMemo(() => {
    if (nearbyMode) return allCategories;
    return allCategories.filter((category) =>
      places.some((place) => place.types?.includes(category))
    );
  }, [nearbyMode, places]);

  useEffect(() => {
    if (availableCategories.length > 0) {
      setLastAvailableCategories(availableCategories);
    }
  }, [availableCategories]);

  const visibleCategories =
    availableCategories.length > 0
      ? availableCategories
      : lastAvailableCategories;

  const shouldShowFilters =
    nearbyMode || favoritesMode || trendingMode || communityFavoritesMode;

  const handleApplyFilters = useCallback(
    (nextSortBy: SortOption, nextMinRating: number | null) => {
      setSortBy(nextSortBy);
      setMinRating(nextMinRating);
      bottomSheet?.close();
    },
    [bottomSheet]
  );

  const handleOpenFilters = useCallback(() => {
    bottomSheet?.expand({
      content: () => (
        <PlacesFilterBottomSheet
          initialSortBy={sortBy}
          initialMinRating={minRating}
          onApply={handleApplyFilters}
          onClose={() => bottomSheet?.close()}
        />
      ),
    });
  }, [bottomSheet, handleApplyFilters, minRating, sortBy]);

  const handleOpenSearch = () => {
    router.push("/main/place-search");
  };

  const handleEndReached = useCallback(() => {
    if (
      !isPaginatedMode ||
      isResettingKey ||
      !hasMore ||
      isFetchingMore ||
      isPaginatedInitialLoading ||
      !hasUserScrolledSinceChangeRef.current ||
      lastAppendedPageRef.current !== activePage ||
      endReachedDuringMomentumRef.current ||
      activePage >= MAX_PAGES
    ) {
      return;
    }
    endReachedDuringMomentumRef.current = true;
    setPage((prev) => prev + 1);
  }, [
    hasMore,
    isFetchingMore,
    isPaginatedInitialLoading,
    isPaginatedMode,
    isResettingKey,
    activePage,
  ]);

  const emptyMode = useMemo(() => {
    if (favoritesMode) return "favorites";
    if (trendingMode) return "trending";
    if (nearbyMode) return "nearby";
    if (communityFavoritesMode) return "communityFavorites";
    if (mostFrequentMode) return "ranking";
    return "default";
  }, [
    favoritesMode,
    trendingMode,
    nearbyMode,
    communityFavoritesMode,
    mostFrequentMode,
  ]);

  const renderPlaceItem = useCallback(
    ({ item, index }: { item: Place; index: number }) => {
      const placeData = {
        id: item.placeId,
        name: item.name,
        address: item.formattedAddress ?? "",
        distance: item.distance,
        activeUsers: (item as any).active_users || 0,
        tag: item.types?.[0] || undefined,
        rank: mostFrequentMode ? item.rank : undefined,
        review: item.review,
      };

      return (
        <Animated.View
          entering={FadeInDown.delay(index * 40).springify()}
          exiting={FadeOut.duration(220)}
          style={styles.placeCardWrapper}
        >
          <PlaceCard
            place={placeData}
            onPress={() => handlePlaceClick(item)}
            onInfoPress={() => showPlaceDetails(item)}
            isFavorite={favoriteIds.has(item.placeId)}
            onToggleFavorite={() =>
              handleToggle(item.placeId, {
                place: item,
                details: { name: item.name, emoji: (item as any).emoji },
              })
            }
          />
        </Animated.View>
      );
    },
    [
      handlePlaceClick,
      showPlaceDetails,
      favoriteIds,
      handleToggle,
      mostFrequentMode,
    ]
  );

  const searchFooterComponent = useMemo(
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
    [colors.text, colors.textSecondary, handleOpenSearch, t]
  );

  const shouldShowSearchFooter =
    !favoritesMode && !trendingMode && !communityFavoritesMode;

  const listFooterComponent = useMemo(() => {
    if (isFetchingMore) {
      return <PlaceLoadingSkeleton count={2} />;
    }
    if (shouldShowSearchFooter && !hasMore) {
      return searchFooterComponent;
    }
    return null;
  }, [hasMore, isFetchingMore, searchFooterComponent, shouldShowSearchFooter]);

  let loadingState: boolean;
  if (trendingMode) {
    loadingState = trendingLoading;
  } else if (favoritesMode) {
    loadingState = favoritePlacesLoading;
  } else if (communityFavoritesMode) {
    loadingState = locationLoading || communityFavoritesLoading;
  } else if (mostFrequentMode) {
    loadingState = locationLoading || mostFrequentFetching;
  } else {
    loadingState = locationLoading || isPaginatedInitialLoading;
  }

  const isLoadingState = useMemo(() => loadingState, [loadingState]);

  return (
    <BaseTemplateScreen
      scrollEnabled={false}
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
              !favoritesMode &&
              !trendingMode &&
              !communityFavoritesMode &&
              !mostFrequentMode
                ? [
                    ...(nearbyMode
                      ? []
                      : [
                          {
                            icon: SlidersHorizontalIcon,
                            onClick: handleOpenFilters,
                            ariaLabel: t("filters.title"),
                            color: colors.icon,
                          },
                        ]),
                    {
                      icon: SearchIcon,
                      onClick: handleOpenSearch,
                      ariaLabel: t("common.search"),
                      color: colors.icon,
                    },
                  ]
                : []
            }
          />
        </ThemedView>
      }
    >
      <ThemedView>
        {shouldShowFilters && (
          <CategoryFilterList
            categories={visibleCategories}
            selectedCategory={activeFilter}
            onSelect={setActiveFilter}
          />
        )}
        {/* Ranking filter pills for mostFrequent mode */}
        {mostFrequentMode && (
          <ThemedView style={styles.rankingPillsContainer}>
            <FilterChip
              label={t("screens.home.categories.ranking.filterMonth")}
              isSelected={rankingFilter === "month"}
              onPress={() => setRankingFilter("month")}
              colors={colors}
              style={styles.rankingPill}
            />
            <FilterChip
              label={t("screens.home.categories.ranking.filterGeneral")}
              isSelected={rankingFilter === "general"}
              onPress={() => setRankingFilter("general")}
              colors={colors}
              style={styles.rankingPill}
            />
          </ThemedView>
        )}
        {(() => {
          if (!hasLocationPermission) {
            return (
              <LocationPermissionState
                canAskAgain={canAskAgain}
                onRequest={requestLocationPermission}
                onOpenSettings={openSettings}
              />
            );
          }

          if (isLoadingState || permissionLoading) {
            return <PlaceLoadingSkeleton count={6} />;
          }

          if (places.length === 0) {
            return (
              <PlacesEmptyState
                mode={emptyMode}
                onPress={() => router.back()}
              />
            );
          }

          return (
            <>
              <FlatList
                ref={listRef}
                data={filteredPlaces}
                keyExtractor={(item) => item.placeId}
                renderItem={renderPlaceItem}
                contentContainerStyle={[
                  styles.listContainer,
                  { paddingBottom: spacing.xl + insets.bottom },
                ]}
                showsVerticalScrollIndicator={false}
                ListFooterComponent={listFooterComponent}
                onEndReached={handleEndReached}
                onEndReachedThreshold={0.4}
                onMomentumScrollBegin={() => {
                  endReachedDuringMomentumRef.current = false;
                }}
                onScrollBeginDrag={() => {
                  endReachedDuringMomentumRef.current = false;
                  hasUserScrolledSinceChangeRef.current = true;
                }}
                initialNumToRender={8}
                maxToRenderPerBatch={8}
                windowSize={7}
                removeClippedSubviews
                updateCellsBatchingPeriod={50}
                keyboardShouldPersistTaps="handled"
              />
            </>
          );
        })()}
      </ThemedView>
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  // Places list
  listContainer: {
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  placeCardWrapper: {
    position: "relative",
  },
  footerContainer: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: spacing.lg,
    alignItems: "center",
    gap: spacing.md,
  },
  footerCopy: {
    textAlign: "center",
    ...typography.caption,
  },
  rankingPillsContainer: {
    flexDirection: "row",
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  rankingPill: {
    flex: 1,
  },
});
