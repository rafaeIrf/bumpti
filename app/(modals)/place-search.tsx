import { MapPinIcon, SearchIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { PlaceCard } from "@/components/place-card";
import { SearchToolbar } from "@/components/search-toolbar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { spacing } from "@/constants/theme";
import { useFavoriteToggle } from "@/hooks/use-favorite-toggle";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { calculateDistance } from "@/modules/location";
import { searchPlacesByText as searchPlacesByTextApi } from "@/modules/places/api";
import { useAppSelector } from "@/modules/store/hooks";
import { favoritesActions } from "@/modules/store/slices";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  location?: { lat: number; lng: number };
  distanceKm?: number | null;
}

export interface PlaceSearchProps {
  onPlaceSelect?: (
    placeId: string,
    placeName: string,
    distance?: number
  ) => void;
  onBack?: () => void;
  isPremium?: boolean;
  autoFocus?: boolean;
}

export default function PlaceSearch({
  onPlaceSelect,
  onBack,
  isPremium = false,
  autoFocus = false,
}: PlaceSearchProps) {
  const colors = useThemeColors();
  const router = useRouter();
  const favoritesState = useAppSelector((state) => state.favorites);
  const { favoriteIds, handleToggle } = useFavoriteToggle();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const location = await Location.getCurrentPositionAsync({});
      setUserLocation({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });
    })();
  }, []);

  useEffect(() => {
    if (!favoritesState.loaded && !favoritesState.isLoading) {
      favoritesActions.fetchFavorites();
    }
  }, [favoritesState.isLoading, favoritesState.loaded]);

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
      debounceTimeout.current = setTimeout(async () => {
        if (query.trim().length < 2) {
          setSearchResults([]);
          setIsSearching(false);
          return;
        }
        if (!userLocation) {
          setIsSearching(false);
          return;
        }
        setIsSearching(true);
        try {
          const res: any = await searchPlacesByTextApi(
            query,
            userLocation.lat,
            userLocation.lng,
            20000
          );
          setSearchResults(
            (res.places || []).map((p: any) => {
              const distance =
                p.location && userLocation
                  ? calculateDistance(
                      userLocation.lat,
                      userLocation.lng,
                      p.location.lat,
                      p.location.lng
                    ) / 1000
                  : null;
              return {
                ...p,
                types: p.types ?? [],
                location: p.location,
                distanceKm: distance,
              };
            })
          );
        } catch {
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 400);
    },
    [userLocation]
  );

  const handleResultPress = (result: SearchResult) => {
    if (onPlaceSelect) {
      onPlaceSelect(result.placeId, result.name);
    } else {
      router.push({
        pathname: "/main/place-people",
        params: {
          placeId: result.placeId,
          placeName: result.name,
        },
      });
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
  };

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
            distance: item.distanceKm ?? 0,
            activeUsers: 0,
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

  return (
    <BaseTemplateScreen isModal TopHeader={header}>
      <ThemedView style={{ flex: 1 }}>
        {searchQuery.trim().length === 0 ? (
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
                <SearchIcon
                  width={40}
                  height={40}
                  color={colors.textSecondary}
                />
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
                style={[
                  styles.suggestionsLabel,
                  { color: colors.textSecondary },
                ]}
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
                      {t(
                        `screens.placeSearch.suggestionsOptions.${suggestion}`
                      )}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              ))}
            </ThemedView>
          </Animated.View>
        ) : isSearching ? (
          <ThemedView style={{ paddingTop: spacing.xl, alignItems: "center" }}>
            <ActivityIndicator size="large" color={colors.accent} />
          </ThemedView>
        ) : searchResults.length > 0 ? (
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.placeId}
            ItemSeparatorComponent={() => (
              <View style={{ height: spacing.sm }} />
            )}
            renderItem={renderResult}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: spacing.xl }}
          />
        ) : (
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
        )}
      </ThemedView>
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
