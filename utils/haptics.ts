import * as Haptics from "expo-haptics";

/**
 * Trigger a selection haptic feedback (most subtle).
 * Works on both iOS and Android.
 * Useful for scrolling through content, changing photos, etc.
 */
export function triggerSelectionHaptic() {
  Haptics.selectionAsync();
}

/**
 * Trigger a light haptic feedback.
 * Works on both iOS and Android.
 * Same effect used in the bottom tab bar.
 */
export function triggerLightHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/**
 * Trigger a medium haptic feedback.
 * Works on both iOS and Android.
 * Useful for confirmations or significant actions.
 */
export function triggerMediumHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/**
 * Trigger a success haptic feedback.
 * Works on both iOS and Android.
 * Useful for successful operations.
 */
export function triggerSuccessHaptic() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/**
 * Trigger an error haptic feedback.
 * Works on both iOS and Android.
 * Useful for error states.
 */
export function triggerErrorHaptic() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}
