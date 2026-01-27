import { logger } from "@/utils/logger";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@bumpti:detection_state";

interface DetectionState {
  dismissed_places: Record<string, number>; // placeId -> timestamp
  last_shown_at: number | null; // timestamp of last banner shown
}

/**
 * Detection Store - Manages detection banner state with automatic cleanup
 * 
 * Features:
 * - Tracks dismissed places with timestamps
 * - Global cooldown for banner display
 * - Automatic garbage collection of old entries
 */
class DetectionStore {
  private static async getState(): Promise<DetectionState> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { dismissed_places: {}, last_shown_at: null };
      }
      return JSON.parse(raw);
    } catch (error) {
      logger.error("Failed to read detection state:", error);
      return { dismissed_places: {}, last_shown_at: null };
    }
  }

  private static async setState(state: DetectionState): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      logger.error("Failed to save detection state:", error);
    }
  }

  /**
   * Mark a place as dismissed
   */
  static async dismissPlace(placeId: string): Promise<void> {
    const state = await this.getState();
    state.dismissed_places[placeId] = Date.now();
    await this.setState(state);
    logger.log(`Place dismissed: ${placeId}`);
  }

  /**
   * Check if a place was recently dismissed
   * @param placeId - Place ID to check
   * @param hoursThreshold - Hours before dismissal expires (default: 12)
   * @returns true if dismissed within threshold
   */
  static async isDismissed(
    placeId: string,
    hoursThreshold: number = 12
  ): Promise<boolean> {
    const state = await this.getState();
    const dismissedAt = state.dismissed_places[placeId];

    if (!dismissedAt) {
      return false;
    }

    const hoursAgo = (Date.now() - dismissedAt) / (1000 * 60 * 60);
    return hoursAgo < hoursThreshold;
  }

  /**
   * Remove dismissed places older than threshold
   * @param daysThreshold - Days to keep dismissals (default: 7)
   */
  static async cleanupDismissedPlaces(
    daysThreshold: number = 7
  ): Promise<void> {
    const state = await this.getState();
    const cutoff = Date.now() - daysThreshold * 24 * 60 * 60 * 1000;

    state.dismissed_places = Object.fromEntries(
      Object.entries(state.dismissed_places).filter(
        ([_, timestamp]) => timestamp > cutoff
      )
    );

    await this.setState(state);
  }

  /**
   * Clear all dismissed places (for testing)
   */
  static async clearDismissedPlaces(): Promise<void> {
    const state = await this.getState();
    state.dismissed_places = {};
    await this.setState(state);
    logger.log("All dismissed places cleared");
  }

  /**
   * Get timestamp of last banner shown
   */
  static async getLastShownAt(): Promise<number | null> {
    const state = await this.getState();
    return state.last_shown_at;
  }

  /**
   * Update timestamp of last banner shown
   */
  static async setLastShownAt(): Promise<void> {
    const state = await this.getState();
    state.last_shown_at = Date.now();
    await this.setState(state);
  }

  /**
   * Check if enough time has passed since last banner display
   * @param minutesCooldown - Minutes to wait between banners (default: 15)
   * @returns true if banner can be shown
   */
  static async canShowBanner(minutesCooldown: number = 15): Promise<boolean> {
    const lastShown = await this.getLastShownAt();
    if (!lastShown) {
      return true;
    }

    const minutesAgo = (Date.now() - lastShown) / (1000 * 60);
    return minutesAgo >= minutesCooldown;
  }

  /**
   * Clear all detection state - useful for testing
   */
  static async clear(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
    logger.log("Detection store cleared");
  }

  /**
   * Initialize store - run cleanup on app start
   */
  static async initialize(): Promise<void> {
    await this.cleanupDismissedPlaces();
    logger.log("Detection store initialized");
  }
}

export default DetectionStore;

