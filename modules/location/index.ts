import * as Linking from "expo-linking";
import * as Location from "expo-location";

/**
 * Location permission status
 */
export type LocationPermissionStatus = "granted" | "denied" | "undetermined";

/**
 * Result of permission request
 */
export interface LocationPermissionResult {
  status: LocationPermissionStatus;
  canAskAgain: boolean;
}

/**
 * Location coordinates
 */
export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
}

/**
 * Check current location permission status
 */
export async function checkLocationPermission(): Promise<LocationPermissionResult> {
  try {
    const { status, canAskAgain } =
      await Location.getForegroundPermissionsAsync();

    return {
      status: status as LocationPermissionStatus,
      canAskAgain: canAskAgain ?? true,
    };
  } catch (error) {
    console.error("Error checking location permission:", error);
    return {
      status: "undetermined",
      canAskAgain: true,
    };
  }
}

/**
 * Check if location permission is granted
 */
export async function hasLocationPermission(): Promise<boolean> {
  const { status } = await checkLocationPermission();
  return status === "granted";
}

/**
 * Request location permission from user
 */
export async function requestLocationPermission(): Promise<LocationPermissionResult> {
  try {
    // First check if already granted
    const currentPermission = await checkLocationPermission();
    if (currentPermission.status === "granted") {
      return currentPermission;
    }

    // Request permission
    const { status, canAskAgain } =
      await Location.requestForegroundPermissionsAsync();

    return {
      status: status as LocationPermissionStatus,
      canAskAgain: canAskAgain ?? false,
    };
  } catch (error) {
    console.error("Error requesting location permission:", error);
    return {
      status: "denied",
      canAskAgain: false,
    };
  }
}

/**
 * Check if we should show the location permission screen
 * Returns true if permission is not granted and we can still ask
 */
export async function shouldShowLocationScreen(): Promise<boolean> {
  const { status } = await checkLocationPermission();

  // Show screen if permission is not granted yet
  return status !== "granted";
}

/**
 * Get current location coordinates
 */
export async function getCurrentLocation(): Promise<LocationCoordinates | null> {
  try {
    const { status } = await checkLocationPermission();
    if (status !== "granted") {
      console.warn("Location permission not granted");
      return null;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      altitude: location.coords.altitude,
      altitudeAccuracy: location.coords.altitudeAccuracy,
      heading: location.coords.heading,
      speed: location.coords.speed,
    };
  } catch (error) {
    console.error("Error getting current location:", error);
    return null;
  }
}

/**
 * Get last known location (faster but may be outdated)
 */
export async function getLastKnownLocation(): Promise<LocationCoordinates | null> {
  try {
    const { status } = await checkLocationPermission();
    if (status !== "granted") {
      console.warn("Location permission not granted");
      return null;
    }

    const location = await Location.getLastKnownPositionAsync();
    if (!location) {
      // If no last known position, get current
      return getCurrentLocation();
    }

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      altitude: location.coords.altitude,
      altitudeAccuracy: location.coords.altitudeAccuracy,
      heading: location.coords.heading,
      speed: location.coords.speed,
    };
  } catch (error) {
    console.error("Error getting last known location:", error);
    return null;
  }
}

/**
 * Watch location changes in real-time
 * Returns a subscription object that can be removed
 */
export async function watchLocation(
  callback: (location: LocationCoordinates) => void,
  options?: {
    accuracy?: Location.Accuracy;
    timeInterval?: number; // milliseconds
    distanceInterval?: number; // meters
  }
): Promise<Location.LocationSubscription | null> {
  try {
    const { status } = await checkLocationPermission();
    if (status !== "granted") {
      console.warn("Location permission not granted");
      return null;
    }

    const subscription = await Location.watchPositionAsync(
      {
        accuracy: options?.accuracy ?? Location.Accuracy.Balanced,
        timeInterval: options?.timeInterval ?? 10000, // 10 seconds
        distanceInterval: options?.distanceInterval ?? 100, // 100 meters
      },
      (location) => {
        callback({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
          altitude: location.coords.altitude,
          altitudeAccuracy: location.coords.altitudeAccuracy,
          heading: location.coords.heading,
          speed: location.coords.speed,
        });
      }
    );

    return subscription;
  } catch (error) {
    console.error("Error watching location:", error);
    return null;
  }
}

/**
 * Geocode address to coordinates
 */
export async function geocodeAddress(
  address: string
): Promise<LocationCoordinates | null> {
  try {
    const results = await Location.geocodeAsync(address);
    if (results.length === 0) {
      return null;
    }

    const result = results[0];
    return {
      latitude: result.latitude,
      longitude: result.longitude,
      accuracy: result.accuracy ?? null,
      altitude: result.altitude ?? null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    };
  } catch (error) {
    console.error("Error geocoding address:", error);
    return null;
  }
}

/**
 * Reverse geocode coordinates to address
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<Location.LocationGeocodedAddress | null> {
  try {
    const results = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });

    if (results.length === 0) {
      return null;
    }

    return results[0];
  } catch (error) {
    console.error("Error reverse geocoding:", error);
    return null;
  }
}

/**
 * Calculate distance between two coordinates (in meters)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Open device settings for location permissions
 */
export async function openLocationSettings() {
  await Linking.openSettings();
}
