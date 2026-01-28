import { SearchIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { LocationPermissionState } from "@/components/location-permission-state";
import { PlaceCard } from "@/components/place-card";
import { PlacesEmptyState } from "@/components/places-empty-state";
import { ScreenBottomBar } from "@/components/screen-bottom-bar";
import { SearchToolbar } from "@/components/search-toolbar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { SelectionCard } from "@/components/ui/selection-card";
import { spacing } from "@/constants/theme";
import { useCachedLocation } from "@/hooks/use-cached-location";
import { useLocationPermission } from "@/hooks/use-location-permission";
import { usePlaceDetailsSheet } from "@/hooks/use-place-details-sheet";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { useLazySearchPlacesByTextQuery } from "@/modules/places/placesApi";
import { formatDistance } from "@/utils/distance";
import { logger } from "@/utils/logger";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

interface SearchResult {
  placeId: string;
  name: string;
  category: string;
  formattedAddress?: string;
  neighborhood?: string;
  distance?: number;
  active_users?: number;
  rating?: number;
  lat: number;
  lng: number;
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
}: PlaceSearchContentProps) {
  const colors = useThemeColors();
  const router = useRouter();
  const params = useLocalSearchParams<{
    multiSelectMode?: string;
    initialSelection?: string;
  }>();

  const multiSelectMode =
    multiSelectModeProp || params.multiSelectMode === "true";

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
  const { showPlaceDetails, favoriteIds, handleToggle } = usePlaceDetailsSheet({
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
        } else {
          setLocalSelectedIds((prev) => [...prev, result.placeId]);
          selectedPlacesMapRef.current[result.placeId] = result.name;
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
    [showPlaceDetails, multiSelectMode, onPlaceToggle, localSelectedIds],
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
          isPremium
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
      router,
    ],
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

        return (
          <SelectionCard
            label={item.name}
            description={description || undefined}
            isSelected={false}
            onPress={() => {
              onUniversitySelect({
                id: item.placeId,
                name: item.name,
                address: item.formattedAddress,
                lat: item.lat,
                lng: item.lng,
              });
            }}
          />
        );
      }

      if (multiSelectMode) {
        const categoryLabel = item.category
          ? t(`place.categories.${item.category}`)
          : "";
        const distanceLabel = item.distance
          ? formatDistance(item.distance)
          : "";
        const description = [categoryLabel, distanceLabel]
          .filter(Boolean)
          .join(" • ");

        return (
          <SelectionCard
            label={item.name}
            description={description || undefined}
            isSelected={isSelected}
            onPress={() => handleResultPress(item)}
          />
        );
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
            tag: item.category,
            review: item.review,
          }}
          onPress={() => handleResultPress(item)}
          isFavorite={favoriteIds.has(item.placeId)}
          onToggleFavorite={() =>
            handleToggle(item.placeId, {
              place: {
                placeId: item.placeId,
                name: item.name,
                formattedAddress: item.formattedAddress,
                neighborhood: item.neighborhood,
                distance: item.distance,
                latitude: item.lat,
                longitude: item.lng,
                types: [item.category],
                active_users: item.active_users,
                review: item.review as any,
              },
              details: { name: item.name, emoji: (item as any).emoji },
            })
          }
        />
      );
    },
    [
      handleResultPress,
      showPlaceDetails,
      favoriteIds,
      handleToggle,
      multiSelectMode,
      localSelectedIds,
      categoryFilter,
      onUniversitySelect,
    ],
  );

  const ItemSeparator: React.FC = () => <View style={{ height: spacing.sm }} />;

  let content: React.ReactNode;
  if (!hasLocationPermission) {
    content = (
      <LocationPermissionState
        canAskAgain={canAskAgain}
        onRequest={requestLocationPermission}
        onOpenSettings={openSettings}
      />
    );
  } else if (searchQuery.trim().length === 0) {
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
                    {t(`screens.placeSearch.suggestionsOptions.${suggestion}`)}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            ))}
        </ThemedView>
      </Animated.View>
    );
  } else if (isFetching || locationLoading) {
    content = (
      <ThemedView style={{ paddingTop: spacing.xl, alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </ThemedView>
    );
  } else if (searchResults.length > 0) {
    content = (
      <FlatList
        data={searchResults}
        keyExtractor={(item) => item.placeId}
        ItemSeparatorComponent={ItemSeparator}
        renderItem={renderResult}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
      />
    );
  } else {
    content = <PlacesEmptyState mode="search" onPress={clearSearch} />;
  }

  const handleDone = useCallback(() => {
    if (onSelectionComplete) {
      onSelectionComplete();
      return;
    }

    // @ts-ignore
    const callback = globalThis.__favoritePlacesCallback;

    if (typeof callback === "function") {
      const selectedPlaces = localSelectedIds.map((id) => ({
        id,
        name: selectedPlacesMapRef.current[id] || "",
      }));

      logger.log("[PlaceSearch] Returning", selectedPlaces.length, "places");
      callback(selectedPlaces);

      // @ts-ignore
      delete globalThis.__favoritePlacesCallback;
    }

    router.back();
  }, [onSelectionComplete, router, localSelectedIds]);

  return (
    <BaseTemplateScreen
      isModal={isModal}
      TopHeader={header}
      BottomBar={
        multiSelectMode && localSelectedIds.length > 0 ? (
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
                  {localSelectedIds.length}{" "}
                  {localSelectedIds.length === 1 ? "lugar" : "lugares"}
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
    gap: spacing.sm,
    width: "100%",
  },
  bottomBarText: {
    flex: 1,
  },
  bottomBarLabel: {
    fontFamily: "Poppins",
    fontWeight: "400",
    fontSize: 13,
  },
  bottomBarCount: {
    fontFamily: "Poppins",
    fontWeight: "600",
    fontSize: 18,
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
    fontFamily: "Poppins",
    fontWeight: "600",
    fontSize: 15,
    color: "#FFFFFF",
  },
});
