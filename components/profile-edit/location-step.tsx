import { SearchIcon } from "@/assets/icons";
import { LoadingView } from "@/components/loading-view";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { InputText } from "@/components/ui/input-text";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { searchCities } from "@/modules/places/api";
import { CityPrediction } from "@/modules/places/types";
import { logger } from "@/utils/logger";
import debounce from "lodash/debounce";
import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

interface LocationStepProps {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
}

type LocationValue =
  | string
  | {
      location?: string | null;
      city_name?: string | null;
    };

const getQueryFromValue = (currentValue: LocationValue) => {
  if (typeof currentValue === "string") return currentValue;
  return currentValue?.location || currentValue?.city_name || "";
};

export function LocationStep({ value, onChange }: LocationStepProps) {
  const colors = useThemeColors();
  const [searchQuery, setSearchQuery] = useState(getQueryFromValue(value));
  const [predictions, setPredictions] = useState<CityPrediction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSearchQuery(getQueryFromValue(value));
  }, [value]);

  const handleSearchCities = async (input: string) => {
    if (!input || input.length < 3) {
      setPredictions([]);
      return;
    }

    try {
      setLoading(true);
      const places = await searchCities(input);
      setPredictions(places);
    } catch (error) {
      logger.error("Error searching cities:", error);
    } finally {
      setLoading(false);
    }
  };

  const debouncedSearch = useCallback(debounce(handleSearchCities, 500), []);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    debouncedSearch(text);
  };

  const handleSelectCity = (city: CityPrediction) => {
    // Parse state and country from formatted address if possible
    // Format is usually "State, Country" or just "Country"
    const parts = city.formattedAddress?.split(",").map((p) => p.trim()) || [];
    const state = parts.length > 1 ? parts[0] : null;
    const country = parts.length > 1 ? parts[1] : parts[0];

    const formattedLocation = state ? `${city.name}, ${state}` : city.name;

    setSearchQuery(formattedLocation);

    onChange({
      city_name: city.name,
      city_state: state,
      city_country: country,
      city_lat: city.latitude,
      city_lng: city.longitude,
      // Keep backward compatibility for display if needed, or just use city_name
      location: formattedLocation,
    });
    setPredictions([]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputWrapper}>
        <InputText
          value={searchQuery}
          onChangeText={handleSearchChange}
          placeholder={t("common.search")}
          leftIcon={SearchIcon}
          onClear={() => {
            setSearchQuery("");
            setPredictions([]);
            onChange("");
          }}
          containerStyle={styles.inputContainer}
        />
      </View>

      {loading && <LoadingView size="small" style={styles.loadingView} />}

      <ScrollView
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {predictions.map((city) => (
          <Button
            key={city.placeId}
            variant="ghost"
            style={[
              styles.predictionItem,
              { borderBottomColor: colors.border },
            ]}
            onPress={() => handleSelectCity(city)}
          >
            <View>
              <ThemedText style={typography.body}>{city.name}</ThemedText>
              <ThemedText
                style={[typography.caption, { color: colors.textSecondary }]}
              >
                {city.formattedAddress}
              </ThemedText>
            </View>
          </Button>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inputWrapper: {
    marginBottom: spacing.md,
  },
  inputContainer: {
    flex: 0,
  },
  loadingView: {
    flex: 0,
    padding: spacing.md,
  },
  listContainer: {
    paddingBottom: spacing.xl,
  },
  predictionItem: {
    justifyContent: "flex-start",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    height: "auto",
    width: "100%",
  },
});
