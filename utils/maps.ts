import { logger } from "@/utils/logger";
import { Linking, Platform } from "react-native";

/**
 * Opens the user's default navigation app with a search query.
 * Uses universal URLs that respect system preferences.
 * 
 * @param query The address or name to search for
 */
export const openMaps = async (query: string) => {
  if (!query) {
    logger.warn("openMaps called with empty query");
    return;
  }

  const encoded = encodeURIComponent(query);
  
  // Use http://maps.apple.com which respects user's default map app on iOS
  // On Android, use geo: which opens the default or shows chooser
  const url = Platform.select({
    ios: `http://maps.apple.com/?q=${encoded}`,
    android: `geo:0,0?q=${encoded}`,
    default: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
  });

  try {
    await Linking.openURL(url);
  } catch (error) {
    logger.error("Error opening maps", error);
    // Fallback to Google Maps web
    try {
      const webUrl = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
      await Linking.openURL(webUrl);
    } catch (fallbackError) {
      logger.error("Error opening fallback maps", fallbackError);
    }
  }
};
