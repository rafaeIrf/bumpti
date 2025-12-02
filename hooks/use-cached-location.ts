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
      setLoading(false)
      return setLocation({ latitude: -25.4030362166611, longitude: -49.2732849121094 }); // TODO: remove this line

    };

    fetchLocation();
  }, []);

  return { location, loading };
};

// Function to manually invalidate the location cache
export const invalidateLocationCache = () => {
  cachedLocation = null;
  lastFetchTime = 0;
};
