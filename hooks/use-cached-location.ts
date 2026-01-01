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
const LOCATION_CACHE_TIME = 1 * 60 * 1000; // 5 minutes in milliseconds

export const useCachedLocation = () => {
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
    city?: string;
    countryCode?: string;
  } | null>(cachedLocation);
  const [loading, setLoading] = useState(!cachedLocation);

  useEffect(() => {
    const fetchLocation = async () => {
      const now = Date.now();
      // If we have cached location and it's less than 5 minutes old, use it
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
          // Reverse geocode to get city and country for efficient backend searching/seeding
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
        setLoading(false);
      } catch (error) {
        console.error("Failed to get user location:", error);
        setLoading(false);
      }
    };

    fetchLocation();
  }, []);
  // return { location: { ...location, city: "Curitiba", countryCode: "BR", latitude: -25.40303156447935, longitude: -49.24624665524243 }, loading };
  return { location,  loading };
};

// Function to manually invalidate the location cache
export const invalidateLocationCache = () => {
  cachedLocation = null;
  lastFetchTime = 0;
};
