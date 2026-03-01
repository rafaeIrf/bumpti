import { SearchIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { LocationPermissionState } from "@/components/location-permission-state";
import { MapDataAttribution } from "@/components/map-data-attribution";
import { PlaceCard } from "@/components/place-card";
import { getCategoryColor, getPlaceIcon } from "@/components/place-card-utils";
import { PlacesEmptyState } from "@/components/places-empty-state";
import { ScreenBottomBar } from "@/components/screen-bottom-bar";
import { SearchToolbar } from "@/components/search-toolbar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BrandIcon } from "@/components/ui/brand-icon";
import { SelectionCard } from "@/components/ui/selection-card";
import { spacing, typography } from "@/constants/theme";
import { useCachedLocation } from "@/hooks/use-cached-location";
import { useLocationPermission } from "@/hooks/use-location-permission";
import { usePlaceDetailsSheet } from "@/hooks/use-place-details-sheet";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import {
  useGetNearbyPlacesQuery,
  useLazySearchPlacesByTextQuery,
} from "@/modules/places/placesApi";
import { formatDistance } from "@/utils/distance";
import { logger } from "@/utils/logger";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

interface SearchResult {
  placeId: string;
  name: string;
  category: string;
  formattedAddress?: string;
  neighborhood?: string;
  distance?: number;
  active_users?: number;
  preview_avatars?: { user_id: string; url: string }[];
  rating?: number;
  lat: number;
  lng: number;
  regulars_count?: number;
  review?: {
    average: number;
    count: number;
    tags?: string[];
  };
}

export interface PlaceSearchContentProps {
  onBack?: () => void;
  isPremium?: boolean;
  autoFocus?: boolean;
  multiSelectMode?: boolean;
  selectedPlaceIds?: string[];
  isModal?: boolean;
  categoryFilter?: string;
  onPlaceToggle?: (placeId: string, placeName: string) => void;
  onSelectionComplete?: () => void;
  onUniversitySelect?: (place: {
    id: string;
    name: string;
    address?: string;
    lat?: number;
    lng?: number;
  }) => void;
  suggestedPlaces?: {
    id: string;
    name: string;
    address?: string;
    distance?: number;
  }[];
  suggestedPlacesLoading?: boolean;
  placeholder?: string;
}

export function PlaceSearchContent({
  onBack,
  isPremium = false,
  autoFocus = false,
  multiSelectMode: multiSelectModeProp = false,
  selectedPlaceIds: selectedPlaceIdsProp = [],
  onPlaceToggle,
  onSelectionComplete,
  isModal = true,
  categoryFilter,
  onUniversitySelect,
  suggestedPlaces: suggestedPlacesProp,
  suggestedPlacesLoading: suggestedPlacesLoadingProp,
  placeholder: placeholderProp,
}: PlaceSearchContentProps) {
  const colors = useThemeColors();
  const router = useRouter();
  const params = useLocalSearchParams<{
    multiSelectMode?: string;
    initialSelection?: string;
    maxSelections?: string;
    otherSelectionsCount?: string;
  }>();

  const multiSelectMode =
    multiSelectModeProp || params.multiSelectMode === "true";

  const maxSelections: number | undefined = params.maxSelections
    ? parseInt(params.maxSelections, 10)
    : undefined;

  const otherSelectionsCount = params.otherSelectionsCount
    ? parseInt(params.otherSelectionsCount, 10)
    : 0;

  const initialSelection = React.useMemo(() => {
    if (!params.initialSelection) return [];

    try {
      return JSON.parse(params.initialSelection) as {
        id: string;
        name: string;
      }[];
    } catch (error) {
      logger.error("[PlaceSearch] Invalid initialSelection:", error);
      return [];
    }
  }, [params.initialSelection]);

  const { location: userLocation, loading: locationLoading } =
    useCachedLocation();

  // ── Internal nearby places fetch (when categoryFilter provided, no external suggestions) ──
  const categoryArray = useMemo(
    () => (categoryFilter ? categoryFilter.split(",") : []),
    [categoryFilter],
  );

  const hasExternalSuggestions = suggestedPlacesProp !== undefined;

  const { data: nearbyPlacesData, isLoading: nearbyLoading } =
    useGetNearbyPlacesQuery(
      {
        latitude: userLocation?.latitude ?? 0,
        longitude: userLocation?.longitude ?? 0,
        category: categoryArray,
        pageSize: 20,
        sortBy: "relevance",
      },
      {
        skip:
          hasExternalSuggestions || !userLocation || categoryArray.length === 0,
      },
    );

  const internalSuggestedPlaces = useMemo(() => {
    if (hasExternalSuggestions) return suggestedPlacesProp ?? [];
    if (!nearbyPlacesData) return [];
    return nearbyPlacesData.map((p) => ({
      id: p.placeId,
      name: p.name,
      address: p.formattedAddress,
      distance: p.distance,
    }));
  }, [hasExternalSuggestions, suggestedPlacesProp, nearbyPlacesData]);

  const suggestedPlaces = internalSuggestedPlaces;
  const suggestedPlacesLoading = hasExternalSuggestions
    ? (suggestedPlacesLoadingProp ?? false)
    : nearbyLoading;

  // Resolve category-specific placeholder internally
  const resolvedPlaceholder = useMemo(() => {
    if (placeholderProp) return placeholderProp;
    const firstCat = categoryArray[0];
    if (firstCat) {
      const key = `screens.placeSearch.categoryPlaceholder.${firstCat}`;
      const translated = t(key);
      if (translated !== key) return translated;
    }
    return undefined;
  }, [placeholderProp, categoryArray]);
  const {
    hasPermission: hasLocationPermission,
    canAskAgain,
    request: requestLocationPermission,
    openSettings,
  } = useLocationPermission();

  const [searchQuery, setSearchQuery] = useState("");
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queryArg = useMemo(
    () =>
      userLocation
        ? { lat: userLocation.latitude, lng: userLocation.longitude }
        : undefined,
    [userLocation],
  );
  const { showPlaceDetails } = usePlaceDetailsSheet({
    queryArg,
  });

  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>(
    initialSelection.map((p) => p.id),
  );

  const selectedPlacesMapRef = useRef<Record<string, string>>(
    initialSelection.reduce(
      (acc, p) => ({ ...acc, [p.id]: p.name }),
      {} as Record<string, string>,
    ),
  );

  const [triggerSearch, { data: searchData, isFetching }] =
    useLazySearchPlacesByTextQuery();

  const searchResults: SearchResult[] = useMemo(() => {
    if (!searchData?.places) return [];
    return searchData.places.map((p: any) => ({
      placeId: p.placeId,
      name: p.name,
      formattedAddress: p.formattedAddress,
      neighborhood: p.neighborhood,
      category: p.types?.[0],
      lat: p.latitude,
      lng: p.longitude,
      distance: p.distance ?? 0,
      active_users: p.active_users || 0,
      regulars_count: p.regulars_count ?? 0,
      review: p.review,
    }));
  }, [searchData]);

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
      debounceTimeout.current = setTimeout(() => {
        if (query.trim().length < 2 || !userLocation) {
          return;
        }
        triggerSearch({
          input: query,
          lat: userLocation.latitude,
          lng: userLocation.longitude,
          radius: 20000,
          category: categoryFilter, // Pass category filter for filtering results
        });
      }, 400);
    },
    [userLocation, triggerSearch, categoryFilter],
  );

  const handleResultPress = useCallback(
    (result: SearchResult) => {
      if (multiSelectMode) {
        const isSelected = localSelectedIds.includes(result.placeId);

        if (isSelected) {
          setLocalSelectedIds((prev) =>
            prev.filter((id) => id !== result.placeId),
          );
          delete selectedPlacesMapRef.current[result.placeId];
        } else if (
          maxSelections === undefined ||
          localSelectedIds.length < maxSelections
        ) {
          setLocalSelectedIds((prev) => [...prev, result.placeId]);
          selectedPlacesMapRef.current[result.placeId] = result.name;
        } else {
          return; // limit reached, silently ignore
        }

        onPlaceToggle?.(result.placeId, result.name);
      } else {
        // Show details sheet instead of directly entering
        showPlaceDetails({
          placeId: result.placeId,
          name: result.name,
          formattedAddress: result.formattedAddress,
          distance: result.distance ?? 0,
          latitude: result.lat,
          longitude: result.lng,
          types: result.category ? [result.category] : [],
          active_users: result.active_users,
          review: result.review as any,
        });
      }
    },
    [
      showPlaceDetails,
      multiSelectMode,
      onPlaceToggle,
      localSelectedIds,
      maxSelections,
    ],
  );

  const clearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  const header = useMemo(
    () => (
      <SearchToolbar
        value={searchQuery}
        onChangeText={handleSearch}
        onClear={clearSearch}
        placeholder={
          resolvedPlaceholder
            ? resolvedPlaceholder
            : isPremium
              ? t("screens.placeSearch.placeholderPremium")
              : t("screens.placeSearch.placeholderDefault")
        }
        onBack={onBack ?? router.back}
        autoFocus={autoFocus}
      />
    ),
    [
      searchQuery,
      handleSearch,
      clearSearch,
      onBack,
      autoFocus,
      isPremium,
      resolvedPlaceholder,
      router,
    ],
  );

  // Shared helper for rendering a SelectionCard with BrandIcon in multi-select mode
  const renderMultiSelectItem = useCallback(
    (opts: {
      id: string;
      name: string;
      category: string;
      address?: string;
      distance?: number;
      isSelected: boolean;
      onPress: () => void;
    }) => {
      const catColor = getCategoryColor(opts.category);
      const CatIcon = getPlaceIcon(opts.category);
      const isAtLimit =
        maxSelections !== undefined && localSelectedIds.length >= maxSelections;

      const brandIconElement = (
        <View style={{ alignItems: "center", gap: 2 }}>
          <BrandIcon
            icon={CatIcon}
            size="md"
            color="#FFFFFF"
            style={{ backgroundColor: catColor, borderWidth: 0 }}
          />
          {opts.distance != null && opts.distance > 0 && (
            <ThemedText
              style={[
                typography.caption,
                { fontSize: 10, color: colors.textSecondary },
              ]}
            >
              {formatDistance(opts.distance)}
            </ThemedText>
          )}
        </View>
      );

      return (
        <SelectionCard
          key={opts.id}
          label={opts.name}
          description={opts.address || undefined}
          isSelected={opts.isSelected}
          leftElement={brandIconElement}
          accentColor={catColor}
          onPress={opts.onPress}
          disabled={isAtLimit}
        />
      );
    },
    [colors.textSecondary, maxSelections, localSelectedIds.length],
  );

  const renderResult = useCallback(
    ({ item }: { item: SearchResult }) => {
      const isSelected = localSelectedIds.includes(item.placeId);

      // University mode - use SelectionCard with address
      if (categoryFilter === "university" && onUniversitySelect) {
        const addressParts = [item.formattedAddress, item.neighborhood].filter(
          Boolean,
        );
        const description = addressParts.join(" • ");

        return renderMultiSelectItem({
          id: item.placeId,
          name: item.name,
          category: item.category,
          address: description || undefined,
          isSelected: false,
          onPress: () => {
            onUniversitySelect({
              id: item.placeId,
              name: item.name,
              address: item.formattedAddress,
              lat: item.lat,
              lng: item.lng,
            });
          },
        });
      }

      if (multiSelectMode) {
        const description = [item.formattedAddress, item.neighborhood]
          .filter(Boolean)
          .join(" • ");

        return renderMultiSelectItem({
          id: item.placeId,
          name: item.name,
          category: item.category,
          address: description || undefined,
          distance: item.distance,
          isSelected,
          onPress: () => handleResultPress(item),
        });
      }

      return (
        <PlaceCard
          place={{
            id: item.placeId,
            name: item.name,
            address:
              item.formattedAddress ?? t("screens.placeSearch.addressFallback"),
            neighborhood: item.neighborhood,
            distance: item.distance ?? 0,
            activeUsers: item.active_users || 0,
            activeUserAvatars: item.preview_avatars ?? undefined,
            tag: item.category,
            review: item.review,
            regularsCount: item.regulars_count ?? 0,
          }}
          onPress={() => handleResultPress(item)}
        />
      );
    },
    [
      handleResultPress,
      multiSelectMode,
      localSelectedIds,
      categoryFilter,
      onUniversitySelect,
      renderMultiSelectItem,
    ],
  );

  let content: React.ReactNode;
  if (!hasLocationPermission) {
    content = (
      <LocationPermissionState
        canAskAgain={canAskAgain}
        onRequest={requestLocationPermission}
        onOpenSettings={openSettings}
      />
    );
  } else if (
    searchQuery.length === 0 &&
    (suggestedPlaces.length > 0 || suggestedPlacesLoading)
  ) {
    // Show suggested places with category icons
    if ((multiSelectMode || onUniversitySelect) && categoryFilter) {
      content = (
        <Animated.View entering={FadeInDown.delay(150).springify()}>
          <ThemedView style={styles.suggestedSection}>
            <ThemedText
              style={[styles.suggestedLabel, { color: colors.textSecondary }]}
            >
              {t("screens.placeSearch.suggestedPlacesLabel")}
            </ThemedText>
            {suggestedPlacesLoading ? (
              <ActivityIndicator
                size="small"
                color={colors.accent}
                style={{ marginTop: spacing.md }}
              />
            ) : (
              suggestedPlaces.map((place) => {
                const isSelected = localSelectedIds.includes(place.id);
                const firstCat = categoryFilter.split(",")[0] ?? "default";

                if (categoryFilter === "university" && onUniversitySelect) {
                  return renderMultiSelectItem({
                    id: place.id,
                    name: place.name,
                    category: firstCat,
                    address: place.address,
                    distance: place.distance,
                    isSelected: false,
                    onPress: () => {
                      onUniversitySelect({
                        id: place.id,
                        name: place.name,
                      });
                    },
                  });
                }

                return renderMultiSelectItem({
                  id: place.id,
                  name: place.name,
                  category: firstCat,
                  address: place.address,
                  distance: place.distance,
                  isSelected,
                  onPress: () =>
                    handleResultPress({
                      placeId: place.id,
                      name: place.name,
                      category: categoryFilter,
                      formattedAddress: place.address,
                      lat: 0,
                      lng: 0,
                    }),
                });
              })
            )}
          </ThemedView>
        </Animated.View>
      );
    } else if (suggestedPlacesLoading && categoryFilter) {
      content = (
        <ThemedView style={{ paddingTop: spacing.xl, alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </ThemedView>
      );
    } else {
      // Default place search empty state
      content = (
        <Animated.View entering={FadeInDown.delay(150).springify()}>
          <ThemedView style={styles.emptyState}>
            <ThemedView
              style={[
                styles.emptyIcon,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <SearchIcon width={40} height={40} color={colors.textSecondary} />
            </ThemedView>
            <ThemedText style={{ color: colors.text, fontSize: 18 }}>
              {t("screens.placeSearch.emptyTitle")}
            </ThemedText>
            <ThemedText
              style={{
                color: colors.textSecondary,
                textAlign: "center",
                maxWidth: 280,
              }}
            >
              {t("screens.placeSearch.emptyDescription")}
            </ThemedText>
          </ThemedView>
          <ThemedView style={styles.suggestions}>
            <ThemedText
              style={[styles.suggestionsLabel, { color: colors.textSecondary }]}
            >
              {t("screens.placeSearch.suggestionsLabel")}
            </ThemedText>
            {["bar", "cafe", "club", "restaurant"]
              .sort((a, b) => {
                const textA = t(`screens.placeSearch.suggestionsOptions.${a}`);
                const textB = t(`screens.placeSearch.suggestionsOptions.${b}`);
                return textA.length - textB.length;
              })
              .map((suggestion) => (
                <Pressable
                  key={suggestion}
                  onPress={() =>
                    handleSearch(
                      t(`screens.placeSearch.suggestionsOptions.${suggestion}`),
                    )
                  }
                >
                  <ThemedView
                    style={[
                      styles.suggestionButton,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <SearchIcon
                      width={16}
                      height={16}
                      color={colors.textSecondary}
                    />
                    <ThemedText style={{ color: colors.text }}>
                      {t(
                        `screens.placeSearch.suggestionsOptions.${suggestion}`,
                      )}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              ))}
          </ThemedView>
        </Animated.View>
      );
    }
  } else if (isFetching || locationLoading) {
    content = (
      <ThemedView style={{ paddingTop: spacing.xl, alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </ThemedView>
    );
  } else if (searchResults.length > 0) {
    content = (
      <View style={{ gap: spacing.sm, paddingBottom: spacing.xl }}>
        {searchResults.map((item) => (
          <View key={item.placeId}>{renderResult({ item })}</View>
        ))}
        <MapDataAttribution />
      </View>
    );
  } else {
    content = <PlacesEmptyState mode="search" onPress={clearSearch} />;
  }

  const handleDone = useCallback(() => {
    if (onSelectionComplete) {
      onSelectionComplete();
      return;
    }

    router.back();
  }, [onSelectionComplete, router]);

  // Fire callback on unmount (back navigation) if not already done
  const localSelectedIdsRef = useRef(localSelectedIds);
  localSelectedIdsRef.current = localSelectedIds;

  React.useEffect(() => {
    const placesMap = selectedPlacesMapRef.current;
    return () => {
      // @ts-ignore
      const callback = globalThis.__favoritePlacesCallback;
      if (typeof callback === "function") {
        const selectedPlaces = localSelectedIdsRef.current.map((id) => ({
          id,
          name: placesMap[id] || "",
        }));
        logger.log(
          "[PlaceSearch] Unmount — returning",
          selectedPlaces.length,
          "places",
        );
        callback(selectedPlaces);
        // @ts-ignore
        delete globalThis.__favoritePlacesCallback;
      }
    };
  }, []);

  return (
    <BaseTemplateScreen
      isModal={isModal}
      TopHeader={header}
      BottomBar={
        multiSelectMode && (localSelectedIds.length > 0 || categoryFilter) ? (
          <ScreenBottomBar variant="custom" showBorder>
            <View style={styles.bottomBarContent}>
              <View style={styles.bottomBarText}>
                <ThemedText
                  style={[
                    styles.bottomBarLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  {t("common.selected")}
                </ThemedText>
                <ThemedText
                  style={[styles.bottomBarCount, { color: colors.text }]}
                >
                  {otherSelectionsCount + localSelectedIds.length}{" "}
                  {otherSelectionsCount + localSelectedIds.length === 1
                    ? "lugar"
                    : "lugares"}
                </ThemedText>
              </View>
              <Pressable
                onPress={handleDone}
                style={({ pressed }) => [
                  styles.doneButton,
                  { backgroundColor: colors.accent },
                  pressed && styles.doneButtonPressed,
                ]}
              >
                <ThemedText style={styles.doneButtonText}>
                  {t("common.done")}
                </ThemedText>
              </Pressable>
            </View>
          </ScreenBottomBar>
        ) : undefined
      }
    >
      <ThemedView style={{ flex: 1 }}>{content}</ThemedView>
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  suggestions: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  suggestionsLabel: {
    fontSize: 12,
    paddingHorizontal: spacing.xs,
  },
  suggestionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  noResults: {
    alignItems: "center",
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  clearButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
  },
  bottomBarContent: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: spacing.md,
  },
  bottomBarText: {
    flex: 1,
  },
  bottomBarLabel: {
    ...typography.captionBold,
  },
  bottomBarCount: {
    ...typography.caption,
  },
  doneButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 24,
  },
  doneButtonPressed: {
    opacity: 0.8,
  },
  doneButtonText: {
    ...typography.body1,
    color: "#FFFFFF",
  },
  suggestedSection: {
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  suggestedLabel: {
    ...typography.caption,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.xs,
  },
});
