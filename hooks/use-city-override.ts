import { SupportedCity } from "@/modules/places/types";
import { logger } from "@/utils/logger";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

const CITY_OVERRIDE_KEY = "city_override";

// Module-level shared state — reactive across all hook instances
let _currentCity: SupportedCity | null = null;
let _initialized = false; // tracks whether AsyncStorage was already read
const _listeners = new Set<(city: SupportedCity | null) => void>();
// External change hooks (e.g. to invalidate GPS cache) — avoids circular imports
const _changeCallbacks = new Set<() => void>();

export function registerCityChangeCallback(fn: () => void): () => void {
  _changeCallbacks.add(fn);
  return () => _changeCallbacks.delete(fn);
}

function notifyListeners(city: SupportedCity | null) {
  _listeners.forEach((fn) => fn(city));
  _changeCallbacks.forEach((fn) => fn());
}

export function useCityOverride() {
  const [selectedCity, setSelectedCity] = useState<SupportedCity | null>(
    _currentCity,
  );
  // loading = true only if AsyncStorage hasn't been read yet
  const [loading, setLoading] = useState(!_initialized);

  // Subscribe to module-level changes
  useEffect(() => {
    const listener = (city: SupportedCity | null) => {
      setSelectedCity(city);
    };
    _listeners.add(listener);
    return () => {
      _listeners.delete(listener);
    };
  }, []);

  // Load persisted override once — only if AsyncStorage hasn't been read yet
  useEffect(() => {
    if (_initialized) {
      setSelectedCity(_currentCity);
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(CITY_OVERRIDE_KEY);
        if (raw) {
          const parsed: SupportedCity = JSON.parse(raw);
          _currentCity = parsed;
          notifyListeners(parsed);
        }
      } catch (err) {
        logger.warn("useCityOverride: failed to load override", err);
      } finally {
        _initialized = true;
        setLoading(false);
      }
    };
    load();
  }, []);

  const setCityOverride = useCallback(async (city: SupportedCity) => {
    try {
      await AsyncStorage.setItem(CITY_OVERRIDE_KEY, JSON.stringify(city));
      _currentCity = city;
      notifyListeners(city);
      logger.info("useCityOverride: city override set to", city.city_name);
    } catch (err) {
      logger.error("useCityOverride: failed to save override", err);
    }
  }, []);

  const clearCityOverride = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(CITY_OVERRIDE_KEY);
      _currentCity = null;
      notifyListeners(null);
      logger.info("useCityOverride: city override cleared");
    } catch (err) {
      logger.error("useCityOverride: failed to clear override", err);
    }
  }, []);

  return { selectedCity, loading, setCityOverride, clearCityOverride };
}
