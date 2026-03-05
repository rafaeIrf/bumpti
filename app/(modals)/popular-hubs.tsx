import { ArrowLeftIcon, UsersIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { getCategoryColor, getPlaceIcon } from "@/components/place-card-utils";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { MAX_SOCIAL_HUBS } from "@/components/social-hubs-manager";
import { ThemedText } from "@/components/themed-text";
import { BrandIcon } from "@/components/ui/brand-icon";
import { SelectionBottomBar } from "@/components/ui/selection-bottom-bar";
import { SelectionCard } from "@/components/ui/selection-card";
import { spacing, typography } from "@/constants/theme";
import { useCachedLocation } from "@/hooks/use-cached-location";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { PopularHub } from "@/modules/places/api";
import { useGetPopularHubsQuery } from "@/modules/places/placesApi";
import { formatDistance } from "@/utils/distance";
import { logger } from "@/utils/logger";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

export default function PopularHubsModal() {
  const router = useRouter();
  const colors = useThemeColors();
  const { location } = useCachedLocation();
  const params = useLocalSearchParams<{ selectedIds?: string }>();

  const { data: popularHubs = [], isLoading: loading } = useGetPopularHubsQuery(
    { latitude: location?.latitude ?? 0, longitude: location?.longitude ?? 0 },
    { skip: !location },
  );

  // All hub IDs currently selected in the parent screen
  const initialSelectedIds = useMemo<string[]>(() => {
    try {
      return params.selectedIds ? JSON.parse(params.selectedIds) : [];
    } catch {
      return [];
    }
  }, [params.selectedIds]);

  // selectedIds contains ALL hub IDs (parent's + newly toggled)
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);

  const selectedPlacesMapRef = useRef<Record<string, string>>({});
  const selectedCategoriesMapRef = useRef<Record<string, string>>({});

  // Populate refs for pre-selected items once popular hubs data loads
  useEffect(() => {
    if (popularHubs.length === 0) return;
    popularHubs.forEach((hub) => {
      if (initialSelectedIds.includes(hub.placeId)) {
        selectedPlacesMapRef.current[hub.placeId] = hub.name;
        selectedCategoriesMapRef.current[hub.placeId] = hub.category;
      }
    });
  }, [popularHubs, initialSelectedIds]);

  const handleToggle = useCallback(
    (hub: PopularHub) => {
      const isSelected = selectedIds.includes(hub.placeId);
      if (isSelected) {
        setSelectedIds((prev) => prev.filter((id) => id !== hub.placeId));
        delete selectedPlacesMapRef.current[hub.placeId];
        delete selectedCategoriesMapRef.current[hub.placeId];
      } else {
        // Enforce absolute max across all hubs
        if (selectedIds.length >= MAX_SOCIAL_HUBS) return;
        setSelectedIds((prev) => [...prev, hub.placeId]);
        selectedPlacesMapRef.current[hub.placeId] = hub.name;
        selectedCategoriesMapRef.current[hub.placeId] = hub.category;
      }
    },
    [selectedIds],
  );

  const fireCallback = useCallback(
    (ids: string[]) => {
      // @ts-ignore
      const callback = globalThis.__popularHubsCallback;
      if (typeof callback !== "function") return;

      // Compute diff vs parent's initial state
      const added = ids
        .filter((id) => !initialSelectedIds.includes(id))
        .map((id) => ({
          id,
          name: selectedPlacesMapRef.current[id] || "",
          category: selectedCategoriesMapRef.current[id] || "",
        }));
      const removed = initialSelectedIds.filter((id) => !ids.includes(id));

      logger.log(
        "[PopularHubs] Returning",
        added.length,
        "added,",
        removed.length,
        "removed",
      );
      callback({ added, removed });
      // @ts-ignore
      delete globalThis.__popularHubsCallback;
    },
    [initialSelectedIds],
  );

  const handleDone = useCallback(() => {
    fireCallback(selectedIds);
    router.back();
  }, [selectedIds, router, fireCallback]);

  // Fire callback on unmount (back navigation without tapping Done)
  useEffect(() => {
    return () => {
      // Intentionally empty — we only fire on Done press
      // Navigating back without Done = no changes
      // @ts-ignore
      delete globalThis.__popularHubsCallback;
    };
  }, []);

  const renderHub = useCallback(
    (hub: PopularHub) => {
      const isSelected = selectedIds.includes(hub.placeId);
      const catColor = getCategoryColor(hub.category);
      const CatIcon = getPlaceIcon(hub.category);

      const brandIconElement = (
        <View style={{ alignItems: "center", gap: 2 }}>
          <BrandIcon
            icon={CatIcon}
            size="md"
            color="#FFFFFF"
            style={{ backgroundColor: catColor, borderWidth: 0 }}
          />
          {hub.distKm > 0 && (
            <ThemedText
              style={[
                typography.caption,
                { fontSize: 10, color: colors.textSecondary },
              ]}
            >
              {formatDistance(hub.distKm)}
            </ThemedText>
          )}
        </View>
      );

      return (
        <SelectionCard
          key={hub.placeId}
          label={hub.name}
          description={hub.formattedAddress || undefined}
          isSelected={isSelected}
          leftElement={brandIconElement}
          accentColor={catColor}
          onPress={() => handleToggle(hub)}
        />
      );
    },
    [selectedIds, colors.textSecondary, handleToggle],
  );

  return (
    <BaseTemplateScreen
      isModal
      TopHeader={
        <ScreenToolbar
          title={t("screens.onboarding.socialHubs.popular.title")}
          leftAction={{
            icon: ArrowLeftIcon,
            onClick: () => router.back(),
            ariaLabel: t("common.back"),
          }}
        />
      }
      BottomBar={
        selectedIds.length > 0 ? (
          <SelectionBottomBar
            selectedCount={selectedIds.length}
            onDone={handleDone}
          />
        ) : undefined
      }
    >
      <View style={styles.content}>
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <ThemedText
            style={[
              typography.body,
              styles.subtitle,
              { color: colors.textSecondary },
            ]}
          >
            {t("screens.onboarding.socialHubs.popular.subtitle")}
          </ThemedText>
        </Animated.View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : popularHubs.length === 0 ? (
          <Animated.View
            entering={FadeInDown.delay(150).springify()}
            style={styles.emptyState}
          >
            <View
              style={[
                styles.emptyIcon,
                { backgroundColor: `${colors.accent}15` },
              ]}
            >
              <UsersIcon width={28} height={28} color={colors.accent} />
            </View>
            <ThemedText
              style={[
                typography.body,
                { color: colors.textSecondary, textAlign: "center" },
              ]}
            >
              {t("screens.onboarding.socialHubs.popular.empty")}
            </ThemedText>
          </Animated.View>
        ) : (
          <Animated.View
            entering={FadeInDown.delay(150).springify()}
            style={styles.hubsList}
          >
            <ThemedText
              style={[
                typography.caption,
                styles.countLabel,
                { color: colors.textSecondary },
              ]}
            >
              {t("screens.onboarding.socialHubs.popular.countLabel", {
                count: popularHubs.length,
              })}
            </ThemedText>
            {popularHubs.map((hub) => renderHub(hub))}
          </Animated.View>
        )}
      </View>
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xxl * 3,
  },
  subtitle: {
    marginBottom: spacing.lg,
  },
  loadingContainer: {
    paddingTop: spacing.xxl,
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: spacing.xxl * 2,
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  hubsList: {
    gap: spacing.sm,
  },
  countLabel: {
    marginBottom: spacing.xs,
  },
});
