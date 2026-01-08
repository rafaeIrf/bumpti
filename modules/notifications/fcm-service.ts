import { supabase } from "@/modules/supabase/client";
import { logger } from "@/utils/logger";
import messaging from "@react-native-firebase/messaging";
import { Platform } from "react-native";

type DevicePlatform = "ios" | "android";

/**
 * Get the current FCM token for this device
 */
export async function getFCMToken(): Promise<string | null> {
  try {
    // Registering for remote messages is handled automatically by the SDK on iOS
    // when using the default configuration side-by-side with Expo.
    // We can directly request the token.

    const token = await messaging().getToken();
    logger.log("FCM token obtained:", token?.substring(0, 20) + "...");
    return token;
  } catch (error) {
    logger.error("Error getting FCM token:", error);
    return null;
  }
}

/**
 * Get the current device platform
 */
export function getDevicePlatform(): DevicePlatform {
  return Platform.OS === "ios" ? "ios" : "android";
}

/**
 * Register the device token with the backend
 * Should be called after login and on app open when authenticated
 */
export async function registerDeviceToken(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      logger.log("No auth session, skipping device registration");
      return false;
    }

    const fcmToken = await getFCMToken();
    if (!fcmToken) {
      logger.warn("No FCM token available");
      return false;
    }

    const platform = getDevicePlatform();
    
    const { error } = await supabase.functions.invoke("register-user-device", {
      body: {
        fcm_token: fcmToken,
        platform,
      },
    });

    if (error) {
      logger.error("Error registering device:", error);
      return false;
    }

    logger.log("Device registered successfully");
    return true;
  } catch (error) {
    logger.error("Error in registerDeviceToken:", error);
    return false;
  }
}

/**
 * Deactivate the device token (call on logout)
 */
export async function deactivateDeviceToken(): Promise<boolean> {
  try {
    const fcmToken = await getFCMToken();
    if (!fcmToken) {
      logger.warn("No FCM token to deactivate");
      return false;
    }

    const { error } = await supabase.functions.invoke("deactivate-user-device", {
      body: {
        fcm_token: fcmToken,
      },
    });

    if (error) {
      logger.error("Error deactivating device:", error);
      return false;
    }

    logger.log("Device deactivated successfully");
    return true;
  } catch (error) {
    logger.error("Error in deactivateDeviceToken:", error);
    return false;
  }
}

/**
 * Setup listener for FCM token refresh events
 * Returns unsubscribe function
 */
export function setupTokenRefreshListener(
  onRefresh: (token: string) => void
): () => void {
  const unsubscribe = messaging().onTokenRefresh((token: string) => {
    logger.log("FCM token refreshed");
    onRefresh(token);
  });

  return unsubscribe;
}

/**
 * Request notification permission (iOS specific, Android auto-granted)
 * Returns true if permission granted
 */
export async function requestFCMPermission(): Promise<boolean> {
  try {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    logger.log("FCM permission status:", enabled ? "granted" : "denied");
    return enabled;
  } catch (error) {
    logger.error("Error requesting FCM permission:", error);
    return false;
  }
}

/**
 * Check if FCM permission is granted
 */
export async function hasFCMPermission(): Promise<boolean> {
  try {
    const authStatus = await messaging().hasPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  } catch (error) {
    logger.error("Error checking FCM permission:", error);
    return false;
  }
}
