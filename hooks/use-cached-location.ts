import { useLocationPermission } from "@/hooks/use-location-permission";
import { getUserPosition } from "@/modules/places";
import { logger } from "@/utils/logger";
import * as Location from "expo-location";
import { useEffect, useState } from "react";

// Cache the user location globally
let cachedLocation: {
  latitude: number;
  longitude: number;
  accuracy?: number;
  city?: string;
  countryCode?: string;
} | null = null;
let lastFetchTime = 0;
const LOCATION_CACHE_TIME = 0.5 * 60 * 1000; // 30 seconds in milliseconds

export const useCachedLocation = () => {
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
    city?: string;
    countryCode?: string;
  } | null>(cachedLocation);
  const [loading, setLoading] = useState(!cachedLocation);
  const { hasPermission } = useLocationPermission();

  useEffect(() => {
    const fetchLocation = async () => {
      // Only fetch if we have permission
      if (!hasPermission) {
        setLoading(false);
        return;
      }

      const now = Date.now();
      // If we have cached location and it's less than CACHE_TIME old, use it
      if (cachedLocation && now - lastFetchTime < LOCATION_CACHE_TIME) {
        logger.info("Using cached location:", cachedLocation);
        setLocation(cachedLocation);
        setLoading(false);
        return;
      }

      // Otherwise, fetch fresh location
      try {
        logger.info("Fetching fresh location...");
        const { latitude, longitude, accuracy } = await getUserPosition();
        
        let city: string | undefined;
        let countryCode: string | undefined;

        try {
          // Reverse geocode to get city and country
          const address = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (address && address.length > 0) {
            city = address[0].city ?? address[0].subregion ?? undefined;
            countryCode = address[0].isoCountryCode ?? undefined;
          }
        } catch (geoError) {
          logger.warn("Failed to reverse geocode:", geoError);
        }

        const newLocation = { latitude, longitude, accuracy, city, countryCode };

        cachedLocation = newLocation;
        lastFetchTime = now;

        logger.info("Fresh location obtained:", newLocation);
        setLocation(newLocation);
      } catch (error) {
        logger.error("Failed to get user location:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLocation();
  }, [hasPermission]);

  return { location: { ...location, loading };
};

// Function to manually invalidate the location cache
export const invalidateLocationCache = () => {
  cachedLocation = null;
  lastFetchTime = 0;
};
