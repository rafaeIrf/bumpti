/**
 * Formats a distance in kilometers to a human-readable string.
 * @param km Distance in kilometers
 * @returns Formatted string (e.g. "800m" or "1.2 km")
 */
export const formatDistance = (km: number): string => {
  if (km < 1) {
    return `${Math.round(km * 1000)}m`;
  }
  return `${km.toFixed(1)} km`;
};
