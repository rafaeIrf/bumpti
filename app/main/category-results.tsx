import { ArrowLeftIcon, MapPinIcon, SearchIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { useCustomBottomSheet } from "@/components/BottomSheetProvider/hooks";
import { PlaceCardCompact } from "@/components/place-card-compact";
import PlaceSearchContent from "@/components/place-search-content";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { spacing, typography } from "@/constants/theme";
import { useCachedLocation } from "@/hooks/use-cached-location";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { useGetNearbyPlacesQuery } from "@/modules/places/placesApi";
import { PlaceType } from "@/modules/places/types";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

// Ícones de placeholder
const TrendingUpIcon = ({ width, height, color }: any) => (
  <ThemedText style={{ fontSize: width / 2 }}>📈</ThemedText>
);

const InfoIcon = ({ width, height, color }: any) => (
  <ThemedText style={{ fontSize: width / 2 }}>ℹ️</ThemedText>
);

interface PlaceResult {
  id: string;
  name: string;
  type: string;
  address: string;
}

export default function CategoryResultsScreen() {
  const colors = useThemeColors();
  const params = useLocalSearchParams();
  const categoryName = params.categoryName as string;
  const placeTypes = params.placeTypes as string;
  const bottomSheet = useCustomBottomSheet();

  // Use cached location hook
  const { location: userLocation, loading: locationLoading } =
    useCachedLocation();

  // Parse place types
  const typesList = placeTypes?.split(",") || [];
  const typesEnum = typesList
    .map((t) => PlaceType[t.trim() as keyof typeof PlaceType])
    .filter(Boolean);

  // Use RTK Query hook - only runs when userLocation is available
  const { data: placesData, isLoading } = useGetNearbyPlacesQuery(
    {
      latitude: userLocation?.latitude ?? 0,
      longitude: userLocation?.longitude ?? 0,
      types: typesEnum,
      rankPreference: "POPULARITY",
      maxResultCount: 20,
    },
    {
      skip: !userLocation, // Don't run query until we have location
    }
  );

  // Transform API results to PlaceResult format
  const places: PlaceResult[] =
    placesData?.map((place: any) => ({
      id: place.placeId,
      name: place.name,
      type: place.types?.[0] || typesList[0],
      address: place.formattedAddress || "",
    })) || [];

  const handlePlaceClick = (place: PlaceResult) => {
    console.log("Place selected:", place.id, place.name);
    // TODO: Navigate to place detail
  };

  const handleOpenSearch = () => {
    if (!bottomSheet) return;
    bottomSheet.expand({
      content: () => (
        <PlaceSearchContent
          onBack={() => bottomSheet.close()}
          onPlaceSelect={(placeId, placeName) => {
            console.log("Place selected from search:", placeId, placeName);
            bottomSheet.close();
            // TODO: Navigate to place detail
          }}
          isPremium={false}
        />
      ),
      draggable: true,
      snapPoints: ["100%"],
    });
  };

  const renderLoadingSkeleton = () => (
    <ThemedView style={styles.skeletonContainer}>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <ThemedView
          key={i}
          style={[
            styles.skeletonCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <ThemedView style={styles.skeletonContent}>
            <ThemedView
              style={[styles.skeletonImage, { backgroundColor: colors.border }]}
            />
            <ThemedView style={styles.skeletonText}>
              <ThemedView
                style={[
                  styles.skeletonLine,
                  styles.skeletonLineTitle,
                  { backgroundColor: colors.border },
                ]}
              />
              <ThemedView
                style={[
                  styles.skeletonLine,
                  styles.skeletonLineSubtitle,
                  { backgroundColor: colors.border },
                ]}
              />
              <ThemedView
                style={[
                  styles.skeletonLine,
                  styles.skeletonLineSmall,
                  { backgroundColor: colors.border },
                ]}
              />
            </ThemedView>
          </ThemedView>
        </ThemedView>
      ))}
    </ThemedView>
  );

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

  const renderPlacesList = () => (
    <ThemedView style={styles.listContainer}>
      {/* Places List */}
      {places.map((place, index) => {
        const placeData = {
          id: place.id,
          name: place.name,
          type: place.type,
          category: place.type,
          formattedAddress: place.address,
          image: "",
          distance: 0,
          isFavorite: false,
          activeUsers: 0,
        };

        return (
          <Animated.View
            key={place.id}
            entering={FadeInDown.delay(index * 30).springify()}
            style={styles.placeCardWrapper}
          >
            <PlaceCardCompact
              place={placeData}
              onClick={() => handlePlaceClick(place)}
              onToggleFavorite={() => {}}
            />
          </Animated.View>
        );
      })}

      {/* Info Footer */}
      <ThemedView
        style={[
          styles.infoFooter,
          {
            backgroundColor: `${colors.surface}80`,
            borderColor: colors.border,
          },
        ]}
      >
        <ThemedView style={styles.infoContent}>
          <InfoIcon width={20} height={20} color={colors.accent} />
          <ThemedText
            style={[styles.infoText, { color: colors.textSecondary }]}
          >
            {t("screens.categoryResults.infoText")}
          </ThemedText>
        </ThemedView>
      </ThemedView>
    </ThemedView>
  );

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
            rightActions={[
              {
                icon: SearchIcon,
                onClick: handleOpenSearch,
                ariaLabel: t("common.search"),
                color: colors.icon,
              },
            ]}
          />
        </ThemedView>
      }
    >
      <ThemedView>
        {locationLoading || isLoading
          ? renderLoadingSkeleton()
          : places.length === 0
          ? renderEmptyState()
          : renderPlacesList()}
      </ThemedView>
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  headerSubtitle: {
    fontSize: 14,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  // Loading skeleton
  skeletonContainer: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  skeletonCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: spacing.md,
  },
  skeletonContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  skeletonImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  skeletonText: {
    flex: 1,
    gap: spacing.sm,
  },
  skeletonLine: {
    height: 16,
    borderRadius: 4,
  },
  skeletonLineTitle: {
    width: "66%",
    height: 20,
  },
  skeletonLineSubtitle: {
    width: "50%",
  },
  skeletonLineSmall: {
    width: "33%",
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 4,
    borderRadius: 999,
  },
  emptyButtonText: {
    fontWeight: "600",
  },
  // Places list
  listContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  placesCount: {
    fontSize: 14,
  },
  placeCardWrapper: {
    position: "relative",
  },
  infoFooter: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: 12,
  },
  infoContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
