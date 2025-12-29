import { logger } from "@/utils/logger";
import { Linking, Platform } from "react-native";

/**
 * Opens the native maps app with a search query.
 * Uses query string for cross-platform compatibility.
 * 
 * @param query The address or name to search for
 */
export const openMaps = async (query: string) => {
  if (!query) {
    logger.warn("openMaps called with empty query");
    return;
  }

  const encoded = encodeURIComponent(query);
  const url = Platform.select({
    ios: `maps:0,0?q=${encoded}`,
    android: `geo:0,0?q=${encoded}`,
    default: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
  });

  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      // Fallback to Google Maps web in case native scheme fails
      const webUrl = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
      await Linking.openURL(webUrl);
    }
  } catch (error) {
    logger.error("Error opening maps", error);
  }
};
