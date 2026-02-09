import { useLocationPermission } from "@/hooks/use-location-permission";
import { useProfile } from "@/hooks/use-profile";
import { getUserPosition } from "@/modules/places";
import { syncLocationToBackend } from "@/modules/profile/helpers";
import { logger } from "@/utils/logger";
import * as Location from "expo-location";
import { useEffect, useState } from "react";

// Hardcoded location for Apple reviewer (they're in the US, but need to see Curitiba)
const REVIEWER_LOCATION = {
  latitude: -25.403060638964643,
  longitude: -49.24663288211306,
  city: "Curitiba",
  countryCode: "BR",
};

// Cache the user location globally
let cachedLocation: {
  latitude: number;
  longitude: number;
  accuracy?: number;
  city?: string;
  countryCode?: string;
} | null = null;
let lastFetchTime = 0;
const LOCATION_CACHE_TIME = 1 * 60 * 1000; // 1 minute in milliseconds


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

  // Check if current user is the reviewer using profile hook
  const { profile } = useProfile();
  const isReviewer = profile?.email?.toLowerCase() === "reviewer@bumpti.com";

  // Set reviewer location immediately if reviewer
  useEffect(() => {
    if (isReviewer) {
      setLocation(REVIEWER_LOCATION);
      setLoading(false);
    }
  }, [isReviewer]);

  useEffect(() => {
    // Skip location fetch for reviewer - they use hardcoded Curitiba
    if (isReviewer) return;

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

        // Sync to backend for nearby activity notifications
        syncLocationToBackend(latitude, longitude, accuracy);
      } catch (error) {
        logger.error("Failed to get user location:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLocation();
  }, [hasPermission, isReviewer]);

  return { location, loading };
};

// Function to manually invalidate the location cache
export const invalidateLocationCache = () => {
  cachedLocation = null;
  lastFetchTime = 0;
};

