import { ArrowLeftIcon, MapPinIcon, SearchIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { useCustomBottomSheet } from "@/components/BottomSheetProvider/hooks";
import { PlaceCard } from "@/components/place-card";
import { PlaceLoadingSkeleton } from "@/components/place-loading-skeleton";
import { ScreenSectionHeading } from "@/components/screen-section-heading";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import Button from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useCachedLocation } from "@/hooks/use-cached-location";
import {
  useFavoritePlacesList,
  type FavoritePlaceResult,
} from "@/hooks/use-favorite-places-list";
import { useFavoriteToggle } from "@/hooks/use-favorite-toggle";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import {
  useGetNearbyPlacesQuery,
  useGetTrendingPlacesQuery,
} from "@/modules/places/placesApi";
import { PlaceType } from "@/modules/places/types";
import { enterPlace } from "@/modules/presence/api";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo } from "react";
import { FlatList, Pressable, StyleSheet } from "react-native";
import Animated, { FadeInDown, FadeOut, Layout } from "react-native-reanimated";

type PlaceResult = FavoritePlaceResult;

export default function CategoryResultsScreen() {
  const colors = useThemeColors();
  const params = useLocalSearchParams();
  const categoryName = params.categoryName as string;
  const placeTypes = params.placeTypes as string;
  const favoritesMode = params.favorites === "true";
  const trendingMode = params.trending === "true";
  const bottomSheet = useCustomBottomSheet();

  // Use cached location hook
  const { location: userLocation, loading: locationLoading } =
    useCachedLocation();

  // Parse place types
  const typesList = placeTypes?.split(",") || [];
  const typesEnum = typesList
    .map((t) => PlaceType[t.trim() as keyof typeof PlaceType])
    .filter(Boolean);

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
  const shouldFetchNearby = !favoritesMode && !trendingMode && !!userLocation;

  const { data: placesData, isLoading } = useGetNearbyPlacesQuery(
    {
      latitude: userLocation?.latitude ?? 0,
      longitude: userLocation?.longitude ?? 0,
      types: typesEnum,
      rankPreference: "POPULARITY",
      maxResultCount: 20,
    },
    {
      skip: !shouldFetchNearby, // skip when favorites, trending or missing location
    }
  );

  const { favoritePlacesData, favoritePlacesLoading, favoriteQueryArg } =
    useFavoritePlacesList(favoritesMode);
  const { favoriteIds, handleToggle } = useFavoriteToggle(favoriteQueryArg);

  // Transform API results to PlaceResult format
  let places: PlaceResult[] = [];
  if (trendingMode) {
    places =
      trendingData?.places?.map((place: any) => ({
        id: place.place_id,
        name: place.name,
        type: place.types?.[0] || "",
        distance: place.distance || 0,
        address: place.address || "",
        active_users: place.active_users,
      })) || [];
  } else if (favoritesMode) {
    places = favoritePlacesData;
  } else {
    places =
      placesData?.map((place: any) => ({
        id: place.placeId,
        name: place.name,
        type: place.type || "",
        distance: place.distance || 0,
        address: place.formattedAddress || "",
        active_users: place.active_users,
      })) || [];
  }

  const handlePlaceClick = useCallback(
    async (place: PlaceResult) => {
      if (!bottomSheet) return;
      enterPlace({
        placeId: place.id,
        lat: userLocation?.latitude ?? null,
        lng: userLocation?.longitude ?? null,
      });

      router.push({
        pathname: "/(modals)/place-people",
        params: {
          placeId: place.id,
          placeName: place.name,
          distance: `${place.distance} km`, // TODO: Calculate real distance
        },
      });
      // bottomSheet.expand({
      //   content: () => (
      //     <ConnectionBottomSheet
      //       venueName={place.name}
      //       currentVenue="Teste"
      //       venueState="active"
      //       onConnect={() => {
      //         bottomSheet.close();
      //         router.push({
      //           pathname: "/(modals)/place-people",
      //           params: {
      //             placeId: place.id,
      //             placeName: place.name,
      //             distance: "1.2 km", // TODO: Calculate real distance
      //           },
      //         });
      //       }}
      //       onCancel={() => {
      //         bottomSheet.close();
      //       }}
      //       onClose={() => {
      //         bottomSheet.close();
      //       }}
      //     />
      //   ),
      //   draggable: true,
      // });
    },
    [bottomSheet, userLocation?.latitude, userLocation?.longitude]
  );

  const handleOpenSearch = () => {
    router.push("/place-search");
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
    ({ item, index }: { item: PlaceResult; index: number }) => {
      const placeData = {
        id: item.id,
        name: item.name,
        type: item.type,
        category: item.type,
        address: item.address,
        image: "",
        distance: item.distance,
        isFavorite: favoriteIds.has(item.id),
        activeUsers: (item as any).active_users || 0,
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
            onToggleFavorite={(id, opts) => handleToggle(id, opts)}
          />
        </Animated.View>
      );
    },
    [favoriteIds, handleToggle, handlePlaceClick]
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
              favoritesMode || trendingMode
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
              {!favoritesMode && !trendingMode && (
                <ScreenSectionHeading
                  titleStyle={{ marginTop: 24 }}
                  title="Populares na sua região"
                />
              )}
              <FlatList
                data={places}
                keyExtractor={(item) => item.id}
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
