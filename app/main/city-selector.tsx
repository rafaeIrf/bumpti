import { ArrowLeftIcon, CheckIcon, MapPinIcon } from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { useCachedLocation } from "@/hooks/use-cached-location";
import { useCityOverride } from "@/hooks/use-city-override";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { useGetSupportedCitiesQuery } from "@/modules/places/placesApi";
import { SupportedCity } from "@/modules/places/types";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

export default function CitySelectorScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { selectedCity, setCityOverride, clearCityOverride } =
    useCityOverride();

  // Wait for location before firing — avoids a no-coords cache entry (unordered)
  // being created before the real location arrives.
  const { location, loading: locationLoading } = useCachedLocation();
  const locationReady = !locationLoading && !!location?.latitude;

  const {
    data: cities = [],
    isLoading,
    isError,
    refetch,
  } = useGetSupportedCitiesQuery(
    locationReady
      ? {
          // Round to 1 decimal place (~11km) to stabilize the RTK cache key.
          // Cities are far enough apart that this precision is sufficient for ordering.
          lat: Math.round(location!.latitude * 10) / 10,
          lng: Math.round(location!.longitude * 10) / 10,
        }
      : undefined,
    { skip: !locationReady },
  );

  const handleSelectCity = async (city: SupportedCity) => {
    await setCityOverride(city);
    router.back();
  };

  const handleUseMyLocation = async () => {
    await clearCityOverride();
    router.back();
  };

  return (
    <BaseTemplateScreen
      TopHeader={
        <ScreenToolbar
          title={t("screens.citySelector.title")}
          leftAction={{
            icon: ArrowLeftIcon,
            onClick: () => router.back(),
            ariaLabel: t("common.back") || "Back",
          }}
        />
      }
    >
      <View style={styles.container}>
        {locationLoading || isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : isError ? (
          <View style={styles.loadingContainer}>
            <ThemedText
              style={[
                typography.body,
                {
                  color: colors.textSecondary,
                  textAlign: "center",
                  marginBottom: spacing.md,
                },
              ]}
            >
              {t("errors.network")}
            </ThemedText>
            <Pressable onPress={refetch} style={styles.retryButton}>
              <ThemedText
                style={[
                  typography.body,
                  { color: colors.accent, fontWeight: "600" },
                ]}
              >
                {t("common.retry")}
              </ThemedText>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Use My Location option */}
            <CityRow
              label={t("screens.citySelector.useMyLocation")}
              sublabel={t("screens.citySelector.useMyLocationDescription")}
              isSelected={!selectedCity}
              onPress={handleUseMyLocation}
              icon={<MapPinIcon width={20} height={20} color={colors.accent} />}
              colors={colors}
            />

            <View
              style={[styles.divider, { backgroundColor: colors.border }]}
            />

            {/* City list */}
            {cities.map((city) => (
              <CityRow
                key={city.id}
                label={city.city_name}
                sublabel={city.country_code}
                isSelected={selectedCity?.id === city.id}
                onPress={() => handleSelectCity(city)}
                colors={colors}
              />
            ))}
          </>
        )}
      </View>
    </BaseTemplateScreen>
  );
}

interface CityRowProps {
  label: string;
  sublabel?: string;
  isSelected: boolean;
  onPress: () => void;
  icon?: React.ReactNode;
  colors: ReturnType<typeof useThemeColors>;
}

function CityRow({
  label,
  sublabel,
  isSelected,
  onPress,
  icon,
  colors,
}: CityRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed
            ? colors.surface
            : isSelected
              ? `${colors.accent}14`
              : "transparent",
        },
      ]}
    >
      {/* Left icon or spacer */}
      <View style={styles.iconContainer}>{icon ?? null}</View>

      {/* Labels */}
      <View style={styles.labelContainer}>
        <ThemedText
          style={[
            typography.body,
            {
              color: isSelected ? colors.accent : colors.text,
              fontWeight: isSelected ? "600" : "400",
            },
          ]}
        >
          {label}
        </ThemedText>
        {sublabel ? (
          <ThemedText
            style={[typography.caption, { color: colors.textSecondary }]}
          >
            {sublabel}
          </ThemedText>
        ) : null}
      </View>

      {/* Check mark */}
      {isSelected && <CheckIcon width={20} height={20} color={colors.accent} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: spacing.xxl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    borderRadius: 12,
    marginVertical: 2,
  },
  iconContainer: {
    width: 24,
    alignItems: "center",
  },
  labelContainer: {
    flex: 1,
    gap: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
  },
  retryButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
  },
});
