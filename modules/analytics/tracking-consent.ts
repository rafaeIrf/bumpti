/**
 * Tracking Consent Manager
 *
 * Handles Apple App Tracking Transparency (ATT) permission.
 * Required for iOS 14.5+ to comply with Apple privacy guidelines.
 *
 * On Android, tracking is always allowed (no system-level prompt).
 */

import { logger } from "@/utils/logger";
import { Platform } from "react-native";

// Lazy import to avoid crash on platforms without expo-tracking-transparency
let TrackingTransparency: typeof import("expo-tracking-transparency") | null = null;

async function getTrackingModule() {
  if (TrackingTransparency) return TrackingTransparency;
  try {
    TrackingTransparency = await import("expo-tracking-transparency");
    return TrackingTransparency;
  } catch {
    logger.warn("expo-tracking-transparency not available");
    return null;
  }
}

export type TrackingStatus = "undetermined" | "denied" | "authorized" | "restricted";

/**
 * Get current tracking permission status.
 *
 * @returns Current tracking authorization status
 */
export async function getTrackingStatus(): Promise<TrackingStatus> {
  if (Platform.OS !== "ios") {
    return "authorized"; // Android doesn't require ATT
  }

  try {
    const module = await getTrackingModule();
    if (!module) return "authorized";

    const { status } = await module.getTrackingPermissionsAsync();
    
    switch (status) {
      case module.PermissionStatus.GRANTED:
        return "authorized";
      case module.PermissionStatus.DENIED:
        return "denied";
      case module.PermissionStatus.UNDETERMINED:
        return "undetermined";
      default:
        return "restricted";
    }
  } catch (error) {
    logger.error("getTrackingStatus error", { error });
    return "authorized"; // Fail open to avoid blocking analytics
  }
}

/**
 * Request tracking permission from the user.
 * Shows the iOS ATT dialog with custom message from app.config.js.
 *
 * @returns Whether tracking was authorized
 */
export async function requestTrackingPermission(): Promise<boolean> {
  if (Platform.OS !== "ios") {
    return true; // Android doesn't require ATT
  }

  try {
    const module = await getTrackingModule();
    if (!module) return true;

    const { status } = await module.requestTrackingPermissionsAsync();
    const authorized = status === module.PermissionStatus.GRANTED;

    logger.info("ATT permission result", { status, authorized });
    return authorized;
  } catch (error) {
    logger.error("requestTrackingPermission error", { error });
    return true; // Fail open to avoid blocking analytics
  }
}

/**
 * Check if tracking is currently allowed.
 * Returns true on Android, or if user granted permission on iOS.
 */
export async function isTrackingAllowed(): Promise<boolean> {
  const status = await getTrackingStatus();
  return status === "authorized" || status === "undetermined";
}

/**
 * Check if we should show the ATT prompt.
 * Only shows on iOS when permission is undetermined.
 */
export async function shouldRequestTracking(): Promise<boolean> {
  if (Platform.OS !== "ios") {
    return false;
  }

  const status = await getTrackingStatus();
  return status === "undetermined";
}
