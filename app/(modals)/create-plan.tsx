import { ArrowLeftIcon, MapPinIcon, SearchIcon, XIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { LocationPermissionState } from "@/components/location-permission-state";
import PlaceCardIcon, { PlaceCardIconData } from "@/components/place-card-icon";
import { ThemedText } from "@/components/themed-text";
import { ActionButton } from "@/components/ui/action-button";
import { Button } from "@/components/ui/button";
import { InputText } from "@/components/ui/input-text";
import { spacing, typography } from "@/constants/theme";
import { useCachedLocation } from "@/hooks/use-cached-location";
import { useLocationPermission } from "@/hooks/use-location-permission";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { useLazySearchPlacesByTextQuery } from "@/modules/places/placesApi";
import { createPlan } from "@/modules/plans/api";
import type { PlanDay, PlanPeriod } from "@/modules/plans/types";
import { logger } from "@/utils/logger";
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
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

// ── Period options ──────────────────────────────────────────────────
const PERIOD_OPTIONS: { value: PlanPeriod; emoji: string }[] = [
  { value: "morning", emoji: "☀️" },
  { value: "afternoon", emoji: "🌤️" },
  { value: "night", emoji: "🌙" },
];

// ── Day options ─────────────────────────────────────────────────────
// DayOption is now PlanDay from types
const DAY_OPTIONS: PlanDay[] = ["today", "tomorrow"];

const TOTAL_STEPS = 2;

export default function CreatePlanModal() {
  const colors = useThemeColors();
  const router = useRouter();
  const { location: userLocation, loading: locationLoading } =
    useCachedLocation();
  const {
    hasPermission: hasLocationPermission,
    canAskAgain,
    request: requestLocationPermission,
    openSettings,
  } = useLocationPermission();

  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<PlanPeriod | null>(null);
  const [selectedDay, setSelectedDay] = useState<PlanDay>("today");
  const [isCreating, setIsCreating] = useState(false);
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── API search ──────────────────────────────────────────────────
  const [triggerSearch, { data: searchData, isFetching }] =
    useLazySearchPlacesByTextQuery();

  const searchResults: PlaceCardIconData[] = useMemo(() => {
    if (!searchData?.places) return [];
    return searchData.places.map((p: any) => ({
      id: p.placeId,
      name: p.name,
      category: p.types?.[0] ? t(`place.categories.${p.types[0]}`) : "",
      address: p.formattedAddress ?? "",
      neighborhood: p.neighborhood,
      distance: p.distance ?? 0,
      activeUsers: p.active_users || 0,
    }));
  }, [searchData]);

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
      debounceTimeout.current = setTimeout(() => {
        if (query.trim().length < 2 || !userLocation) return;
        triggerSearch({
          input: query,
          lat: userLocation.latitude,
          lng: userLocation.longitude,
          radius: 20000,
        });
      }, 400);
    },
    [userLocation, triggerSearch],
  );

  // Re-trigger search when location becomes available (fixes iOS where location resolves late)
  useEffect(() => {
    if (userLocation && searchQuery.trim().length >= 2) {
      triggerSearch({
        input: searchQuery,
        lat: userLocation.latitude,
        lng: userLocation.longitude,
        radius: 20000,
      });
    }
  }, [userLocation]);

  // ── Android back: go to step 1 instead of closing ────────────────
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (currentStep === 2) {
        setCurrentStep(1);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [currentStep]);

  // ── Handlers ─────────────────────────────────────────────────────
  const handleClose = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
      setSelectedPeriod(null);
      setSelectedDay("today");
    } else {
      router.back();
    }
  };

  const handlePlaceSelect = (place: PlaceCardIconData) => {
    setSelectedPlace({ id: place.id, name: place.name });
    setCurrentStep(2);
  };

  const handleConfirm = async () => {
    if (!selectedPeriod || !selectedPlace || isCreating) return;

    setIsCreating(true);
    try {
      const result = await createPlan({
        placeId: selectedPlace.id,
        placeName: selectedPlace.name,
        period: selectedPeriod,
        day: selectedDay,
      });

      if (result) {
        logger.log("[CreatePlan] Plan created:", {
          presenceId: result.id,
          placeId: selectedPlace.id,
          period: selectedPeriod,
          day: selectedDay,
        });
        router.dismissAll();
      } else {
        logger.error("[CreatePlan] Failed to create plan");
      }
    } catch (err) {
      logger.error("[CreatePlan] Error creating plan:", { err });
    } finally {
      setIsCreating(false);
    }
  };

  // ── Custom header (title, subtitle, dots) ────────────────────────
  const renderHeader = () => (
    <View style={styles.header}>
      {/* Close (step 1) / Back (step 2) button */}
      <ActionButton
        icon={currentStep === 1 ? XIcon : ArrowLeftIcon}
        onPress={currentStep === 1 ? handleClose : () => setCurrentStep(1)}
        ariaLabel={currentStep === 1 ? t("common.close") : t("common.back")}
        size="sm"
        style={styles.closeButton}
      />

      {/* Title — same on both steps */}
      <ThemedText style={[styles.headerTitle, { color: colors.text }]}>
        {t("screens.home.createPlan.location.title")}
      </ThemedText>

      {/* Subtitle — changes per step */}
      <ThemedText
        style={[styles.headerSubtitle, { color: colors.textSecondary }]}
      >
        {currentStep === 1
          ? t("screens.home.createPlan.location.subtitle")
          : t("screens.home.createPlan.period.title")}
      </ThemedText>

      {/* Step dots */}
      <View style={styles.dotsRow}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor:
                  i + 1 <= currentStep ? colors.accent : colors.border,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );

  // ── Step 1: Location search ──────────────────────────────────────
  const renderLocationStep = () => {
    if (!hasLocationPermission) {
      return (
        <View style={styles.stepContent}>
          <LocationPermissionState
            canAskAgain={canAskAgain}
            onRequest={requestLocationPermission}
            onOpenSettings={openSettings}
          />
        </View>
      );
    }

    return (
      <View style={styles.stepContent}>
        {/* Search input using InputText */}
        <InputText
          value={searchQuery}
          onChangeText={handleSearch}
          placeholder={t("screens.home.createPlan.location.searchPlaceholder")}
          leftIcon={SearchIcon}
          leftIconColor={colors.accent}
          showClearButton
          onClear={() => handleSearch("")}
          autoFocus
          containerStyle={styles.searchContainer}
        />

        {/* Place list */}
        <ScrollView
          style={styles.placesList}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {(isFetching ||
            (locationLoading && searchQuery.trim().length >= 2)) && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          )}
          {!isFetching &&
            !locationLoading &&
            searchQuery.trim().length >= 2 &&
            searchResults.length === 0 && (
              <ThemedText
                style={[
                  typography.caption,
                  {
                    color: colors.textSecondary,
                    textAlign: "center",
                    marginTop: spacing.lg,
                  },
                ]}
              >
                {t("screens.home.createPlan.location.noResults")}
              </ThemedText>
            )}
          {!isFetching &&
            !locationLoading &&
            searchResults.map((place, index) => (
              <Animated.View
                key={place.id}
                entering={FadeInDown.delay(index * 60).springify()}
              >
                <PlaceCardIcon
                  place={place}
                  onPress={() => handlePlaceSelect(place)}
                />
              </Animated.View>
            ))}
        </ScrollView>
      </View>
    );
  };

  // ── Step 2: Period selection ──────────────────────────────────────
  const renderPeriodStep = () => (
    <View style={styles.stepContent}>
      {/* Selected place card */}
      <Animated.View entering={FadeInDown.delay(80).springify()}>
        <View
          style={[
            styles.selectedPlaceCard,
            {
              backgroundColor: colors.accent + "15",
              borderColor: colors.accent + "40",
            },
          ]}
        >
          <View
            style={[
              styles.placeIconCircle,
              { backgroundColor: colors.accent + "30" },
            ]}
          >
            <MapPinIcon width={18} height={18} color={colors.accent} />
          </View>
          <View style={styles.placeTextCol}>
            <ThemedText
              style={[typography.caption, { color: colors.textSecondary }]}
            >
              {t("screens.home.createPlan.period.subtitle")}
            </ThemedText>
            <ThemedText style={[typography.subheading, { color: colors.text }]}>
              {selectedPlace?.name}
            </ThemedText>
          </View>
        </View>
      </Animated.View>

      {/* Day selection label + pills */}
      <Animated.View entering={FadeInDown.delay(120).springify()}>
        <ThemedText
          style={[
            typography.subheading,
            { color: colors.text, marginBottom: spacing.sm },
          ]}
        >
          {t("screens.home.createPlan.period.dayLabel")}
        </ThemedText>
        <View style={styles.dayPillsRow}>
          {DAY_OPTIONS.map((day) => {
            const isActive = selectedDay === day;
            return (
              <Pressable
                key={day}
                onPress={() => setSelectedDay(day)}
                style={[
                  styles.dayPill,
                  {
                    backgroundColor: isActive ? colors.accent : colors.surface,
                    borderColor: isActive ? colors.accent : colors.border,
                  },
                ]}
              >
                <ThemedText
                  style={[
                    typography.body,
                    {
                      color: isActive ? "#FFFFFF" : colors.textSecondary,
                    },
                  ]}
                >
                  {t(`screens.home.createPlan.period.days.${day}`)}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>

      {/* Period label + cards */}
      <ThemedText
        style={[
          typography.subheading,
          { color: colors.text, marginBottom: spacing.sm },
        ]}
      >
        {t("screens.home.createPlan.period.periodLabel")}
      </ThemedText>
      <ScrollView
        style={styles.periodsList}
        showsVerticalScrollIndicator={false}
      >
        {PERIOD_OPTIONS.map((option, index) => {
          const isSelected = selectedPeriod === option.value;
          return (
            <Animated.View
              key={option.value}
              entering={FadeInDown.delay(150 + index * 60).springify()}
            >
              <Pressable
                onPress={() => setSelectedPeriod(option.value)}
                style={({ pressed }) => [
                  styles.periodCard,
                  {
                    backgroundColor: isSelected
                      ? colors.accent + "18"
                      : colors.surface,
                    borderColor: isSelected ? colors.accent : "transparent",
                    borderWidth: isSelected ? 1.5 : 0,
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <ThemedText style={styles.periodEmoji}>
                  {option.emoji}
                </ThemedText>
                <ThemedText
                  style={[
                    typography.subheading,
                    {
                      color: isSelected ? colors.accent : colors.text,
                    },
                  ]}
                >
                  {t(`screens.home.createPlan.period.periods.${option.value}`)}
                </ThemedText>
              </Pressable>
            </Animated.View>
          );
        })}
      </ScrollView>

      {/* Confirm button */}
      <Animated.View
        entering={FadeInDown.delay(500).springify()}
        style={styles.confirmContainer}
      >
        <Button
          label={t("screens.home.createPlan.period.confirm")}
          onPress={handleConfirm}
          disabled={!selectedPeriod || isCreating}
          loading={isCreating}
          fullWidth
          size="lg"
        />
      </Animated.View>
    </View>
  );

  // ── Render ───────────────────────────────────────────────────────
  return (
    <BaseTemplateScreen isModal TopHeader={renderHeader()}>
      {currentStep === 1 ? renderLocationStep() : renderPeriodStep()}
    </BaseTemplateScreen>
  );
}

// ── Styles ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Header
  header: {
    alignItems: "center",
    paddingBottom: spacing.md,
  },
  closeButton: {
    position: "absolute",
    left: spacing.md,
    top: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    ...typography.subheading2,
    textAlign: "center",
  },
  headerSubtitle: {
    ...typography.caption,
    marginTop: 4,
    textAlign: "center",
  },
  dotsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: spacing.sm,
  },
  dot: {
    width: 28,
    height: 4,
    borderRadius: 2,
  },

  // Shared step wrapper
  stepContent: {
    flex: 1,
  },

  // Step 1
  searchContainer: {
    marginBottom: spacing.md,
  },
  placesList: {
    flex: 1,
  },
  loadingContainer: {
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
  placeIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  placeTextCol: {
    flex: 1,
  },

  // Step 2
  selectedPlaceCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  dayPillsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dayPill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
  },
  periodsList: {
    flex: 1,
  },
  periodCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: 14,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  periodEmoji: {
    fontSize: 28,
  },
  periodTextCol: {
    flex: 1,
  },
  confirmContainer: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
});
