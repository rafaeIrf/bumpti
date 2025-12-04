import { getUserPosition } from "@/modules/places";
import { logger } from "@/utils/logger";
import { useEffect, useState } from "react";

// Cache the user location globally
let cachedLocation: { latitude: number; longitude: number } | null = null;
let lastFetchTime = 0;
const LOCATION_CACHE_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds

export const useCachedLocation = () => {
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
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
        const { latitude, longitude } = await getUserPosition();
        const newLocation = { latitude, longitude };

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
  return { location: { latitude: -25.403026776571462, longitude: -49.24613934328059 }, loading };
};

// Function to manually invalidate the location cache
export const invalidateLocationCache = () => {
  cachedLocation = null;
  lastFetchTime = 0;
};
