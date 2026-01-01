import Constants from "expo-constants";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";

/**
 * Notification permission status
 */
export type NotificationPermissionStatus =
  | "granted"
  | "denied"
  | "undetermined";

/**
 * Result of permission request
 */
export interface NotificationPermissionResult {
  status: NotificationPermissionStatus;
  canAskAgain: boolean;
}

/**
 * Check current notification permission status
 */
export async function checkNotificationPermission(): Promise<NotificationPermissionResult> {
  try {
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();

    return {
      status: status as NotificationPermissionStatus,
      canAskAgain: canAskAgain ?? true,
    };
  } catch (error) {
    console.error("Error checking notification permission:", error);
    return {
      status: "undetermined",
      canAskAgain: true,
    };
  }
}

/**
 * Check if notification permission is granted
 */
export async function hasNotificationPermission(): Promise<boolean> {
  const { status } = await checkNotificationPermission();
  return status === "granted";
}

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionResult> {
  try {
    // First check if already granted
    const currentPermission = await checkNotificationPermission();
    if (currentPermission.status === "granted") {
      return currentPermission;
    }

    // Request permission
    const { status, canAskAgain } =
      await Notifications.requestPermissionsAsync();

    return {
      status: status as NotificationPermissionStatus,
      canAskAgain: canAskAgain ?? false,
    };
  } catch (error) {
    console.error("Error requesting notification permission:", error);
    return {
      status: "denied",
      canAskAgain: false,
    };
  }
}

/**
 * Check if we should show the notification permission screen
 * Returns true if permission is not granted and we can still ask
 */
export async function shouldShowNotificationScreen(): Promise<boolean> {
  const { status } = await checkNotificationPermission();

  // Show screen if permission is not granted yet
  return status !== "granted";
}

/**
 * Configure notification handler for when app is in foreground
 */
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Get push notification token (for sending notifications via API)
 */
export async function getPushNotificationToken(): Promise<string | null> {
  try {
    const isDevice = Constants.isDevice;
    if (!isDevice) {
      console.warn("Push notifications only work on physical devices");
      return null;
    }

    const { status } = await checkNotificationPermission();
    if (status !== "granted") {
      console.warn("Notification permission not granted");
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });

    return tokenData.data;
  } catch (error) {
    console.error("Error getting push token:", error);
    return null;
  }
}

/**
 * Schedule a local notification (for testing or reminders)
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  delaySeconds: number = 0
) {
  try {
    const { status } = await checkNotificationPermission();
    if (status !== "granted") {
      console.warn("Cannot schedule notification: permission not granted");
      return null;
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
      },
      trigger:
        delaySeconds > 0
          ? {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds: delaySeconds,
            }
          : null, // null = immediate
    });

    return notificationId;
  } catch (error) {
    console.error("Error scheduling notification:", error);
    return null;
  }
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error("Error canceling notifications:", error);
  }
}

/**
 * Open device settings for notification permissions
 */
export async function openNotificationSettings() {
  await Linking.openSettings();
}
