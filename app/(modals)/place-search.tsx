import { MapPinIcon, SearchIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { PlaceCard } from "@/components/place-card";
import { SearchToolbar } from "@/components/search-toolbar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { spacing } from "@/constants/theme";
import { useCachedLocation } from "@/hooks/use-cached-location";
import { useFavoriteToggle } from "@/hooks/use-favorite-toggle";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { useLazySearchPlacesByTextQuery } from "@/modules/places/placesApi";
import { enterPlace } from "@/modules/presence/api";
import { useRouter } from "expo-router";
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
  types: string[];
  formattedAddress?: string;
  distance?: number; // Distance in km from backend
  active_users?: number;
}

export interface PlaceSearchProps {
  onBack?: () => void;
  isPremium?: boolean;
  autoFocus?: boolean;
}

export default function PlaceSearch({
  onBack,
  isPremium = false,
  autoFocus = false,
}: PlaceSearchProps) {
  const colors = useThemeColors();
  const router = useRouter();
  const { location: userLocation, loading: locationLoading } =
    useCachedLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { favoriteIds, handleToggle } = useFavoriteToggle(
    userLocation
      ? { lat: userLocation.latitude, lng: userLocation.longitude }
      : undefined
  );

  // Use RTK Query lazy query
  const [triggerSearch, { data: searchData, isFetching }] =
    useLazySearchPlacesByTextQuery();

  const searchResults: SearchResult[] = useMemo(() => {
    if (!searchData?.places) return [];

    return searchData.places.map((p: any) => ({
      placeId: p.placeId,
      name: p.name,
      formattedAddress: p.formattedAddress,
      types: p.types ?? [],
      distance: p.distance ?? 0, // Distance already calculated by backend in km
      active_users: p.active_users || 0,
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
        });
      }, 400);
    },
    [userLocation, triggerSearch]
  );

  const handleResultPress = useCallback(
    (result: SearchResult) => {
      enterPlace({
        placeId: result.placeId,
        lat: userLocation?.latitude ?? null,
        lng: userLocation?.longitude ?? null,
      });
      router.push({
        pathname: "/(modals)/place-people",
        params: {
          placeId: result.placeId,
          placeName: result.name,
        },
      });
    },
    [router]
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
    ]
  );

  const renderResult = useCallback(
    ({ item }: { item: SearchResult }) => {
      const tagRaw = item.types?.find(
        (type) => type !== "point_of_interest" && type !== "establishment"
      );
      const tag = (tagRaw || item.types?.[0])
        ?.replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());

      return (
        <PlaceCard
          place={{
            id: item.placeId,
            name: item.name,
            address:
              item.formattedAddress ?? t("screens.placeSearch.addressFallback"),
            distance: item.distance ?? 0,
            activeUsers: item.active_users || 0,
            isFavorite: favoriteIds.has(item.placeId),
            tag,
          }}
          onPress={() => handleResultPress(item)}
          onToggleFavorite={(id, opts) => handleToggle(id, opts)}
        />
      );
    },
    [favoriteIds, handleResultPress, handleToggle]
  );

  // Move ItemSeparatorComponent out of render
  const ItemSeparator: React.FC = () => <View style={{ height: spacing.sm }} />;

  let content: React.ReactNode;
  if (searchQuery.trim().length === 0) {
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
          {["bar", "cafe", "club", "restaurant"].map((suggestion) => (
            <Pressable
              key={suggestion}
              onPress={() =>
                handleSearch(
                  t(`screens.placeSearch.suggestionsOptions.${suggestion}`)
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
    content = (
      <ThemedView style={styles.noResults}>
        <ThemedView
          style={[
            styles.emptyIcon,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <MapPinIcon width={40} height={40} color={colors.textSecondary} />
        </ThemedView>
        <ThemedText
          style={{
            color: colors.text,
            fontSize: 18,
            marginBottom: spacing.xs,
          }}
        >
          {t("screens.placeSearch.noResultsTitle")}
        </ThemedText>
        <ThemedText
          style={{
            color: colors.textSecondary,
            textAlign: "center",
            maxWidth: 280,
          }}
        >
          {t("screens.placeSearch.noResultsDescription")}
        </ThemedText>
        <Pressable onPress={clearSearch}>
          <ThemedView
            style={[styles.clearButton, { backgroundColor: colors.accent }]}
          >
            <ThemedText style={{ color: "#000", fontWeight: "600" }}>
              {t("screens.placeSearch.clearButton")}
            </ThemedText>
          </ThemedView>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <BaseTemplateScreen isModal TopHeader={header}>
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
});
