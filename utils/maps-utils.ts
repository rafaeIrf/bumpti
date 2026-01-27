import { t } from "@/modules/locales";
import { logger } from "@/utils/logger";
import { ActionSheetIOS, Linking, Platform } from "react-native";

// URL schemes for each map app
const MAP_SCHEMES = {
  apple: "maps://",
  google: "comgooglemaps://",
  waze: "waze://",
} as const;

type MapApp = keyof typeof MAP_SCHEMES;

interface MapsParams {
  /** Place name (required for display and search query) */
  name: string;
  /** Full formatted address if available */
  formattedAddress?: string;
  /** Latitude - used only as last resort fallback */
  lat?: number;
  /** Longitude - used only as last resort fallback */
  lng?: number;
}

interface MapAppConfig {
  key: MapApp;
  scheme: string;
  labelKey: string;
  buildUrl: (query: string) => string;
}

/**
 * Terms that "pollute" map search queries and should be removed.
 * These are typically building/unit identifiers that confuse map apps.
 */
const NOISE_PATTERNS = [
  /\s*-?\s*loja\s*\d*/gi,
  /\s*-?\s*sala\s*\d*/gi,
  /\s*-?\s*andar\s*\d*/gi,
  /\s*-?\s*bloco\s*[a-z\d]*/gi,
  /\s*-?\s*torre\s*[a-z\d]*/gi,
  /\s*-?\s*apt\.?\s*\d*/gi,
  /\s*-?\s*apartamento\s*\d*/gi,
  /\s*-?\s*unidade\s*\d*/gi,
  /\s*-?\s*piso\s*\d*/gi,
  /\s*-?\s*box\s*\d*/gi,
  /\s*-?\s*lj\.?\s*\d*/gi,
  /\s*-?\s*sl\.?\s*\d*/gi,
  /\s*,\s*,/g, // Double commas from removed parts
];

/**
 * Cleans and formats a map query string for optimal search results.
 * Removes noise terms and normalizes spacing.
 */
function cleanMapQuery(query: string): string {
  let cleaned = query;

  // Apply all noise pattern removals
  for (const pattern of NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }

  // Normalize whitespace and punctuation
  cleaned = cleaned
    .replace(/\s+/g, " ") // Multiple spaces → single space
    .replace(/,\s*,/g, ",") // Double commas
    .replace(/\s*,\s*/g, ", ") // Normalize comma spacing
    .replace(/^\s*,\s*/, "") // Leading comma
    .replace(/\s*,\s*$/, "") // Trailing comma
    .trim();

  return cleaned;
}

/**
 * Formats a place into an optimized map query string.
 * Prioritizes "Name, Address" format for better map app intelligence.
 *
 * @returns A clean query string like "Starbucks, Av. Paulista 1000 - São Paulo"
 */
function formatMapQuery(params: MapsParams): string {
  const { name, formattedAddress, lat, lng } = params;

  // Priority 1: Name + Full Address (best for map app intelligence)
  if (formattedAddress && formattedAddress.trim()) {
    const query = `${name}, ${formattedAddress}`;
    return cleanMapQuery(query);
  }

  // Priority 2: Just the name (still allows map apps to search)
  if (name && name.trim()) {
    return cleanMapQuery(name);
  }

  // Priority 3: Coordinates as last resort (generic names or missing data)
  if (lat !== undefined && lng !== undefined) {
    return `${lat},${lng}`;
  }

  return "";
}

/**
 * Safely encode a string for use in URL schemes.
 * Handles special characters like &, #, ?, etc.
 */
const safeEncode = (value: string): string => {
  return encodeURIComponent(value);
};

/**
 * Build the URL for each map app using query-based search.
 */
const mapConfigs: MapAppConfig[] = [
  {
    key: "apple",
    scheme: MAP_SCHEMES.apple,
    labelKey: "maps.appleMaps",
    buildUrl: (query) => `http://maps.apple.com/?q=${safeEncode(query)}`,
  },
  {
    key: "google",
    scheme: MAP_SCHEMES.google,
    labelKey: "maps.googleMaps",
    buildUrl: (query) => `comgooglemaps://?q=${safeEncode(query)}`,
  },
  {
    key: "waze",
    scheme: MAP_SCHEMES.waze,
    labelKey: "maps.waze",
    buildUrl: (query) => `waze://?q=${safeEncode(query)}&navigate=yes`,
  },
];

/**
 * Check which map apps are installed on the device.
 */
async function getAvailableMapApps(): Promise<MapAppConfig[]> {
  const results = await Promise.all(
    mapConfigs.map(async (config) => {
      try {
        const canOpen = await Linking.canOpenURL(config.scheme);
        return canOpen ? config : null;
      } catch {
        return null;
      }
    })
  );

  return results.filter((config): config is MapAppConfig => config !== null);
}

/**
 * Open Google Maps in the browser as fallback.
 */
async function openGoogleMapsWeb(query: string): Promise<void> {
  const url = `https://www.google.com/maps/search/?api=1&query=${safeEncode(query)}`;

  try {
    await Linking.openURL(url);
  } catch (error) {
    logger.error("[MapsUtils] Failed to open Google Maps web fallback", error);
  }
}

/**
 * Open a specific map app with the given query.
 */
async function openMapApp(
  config: MapAppConfig,
  query: string
): Promise<boolean> {
  const url = config.buildUrl(query);

  try {
    await Linking.openURL(url);
    return true;
  } catch (error) {
    logger.error(`[MapsUtils] Failed to open ${config.key}`, error);
    return false;
  }
}

/**
 * Show iOS ActionSheet to choose between available map apps.
 */
function showMapChooserIOS(
  availableApps: MapAppConfig[],
  query: string
): void {
  const options = [
    ...availableApps.map((app) => t(app.labelKey)),
    t("maps.cancel"),
  ];

  ActionSheetIOS.showActionSheetWithOptions(
    {
      title: t("maps.chooseApp"),
      options,
      cancelButtonIndex: options.length - 1,
    },
    async (buttonIndex) => {
      if (buttonIndex < availableApps.length) {
        const selectedApp = availableApps[buttonIndex];
        const success = await openMapApp(selectedApp, query);
        if (!success) {
          await openGoogleMapsWeb(query);
        }
      }
    }
  );
}

/**
 * Opens a map application with navigation to the specified place.
 *
 * Uses identity-based search (Name + Address) instead of raw coordinates.
 * This allows map apps (Google/Waze) to use their own intelligence to
 * locate the place correctly, even if Overture coordinates have slight deviations.
 *
 * On iOS: Shows ActionSheet to choose between installed apps (Apple Maps, Google Maps, Waze).
 * On Android: Uses geo: scheme which triggers native app chooser.
 * Falls back to Google Maps web if no apps are available or opening fails.
 *
 * @param params - Place information with name and optional address/coordinates
 *
 * @example
 * ```ts
 * // Best: Name + Address for precise search
 * openMapsWithChooser({
 *   name: "Starbucks Reserve",
 *   formattedAddress: "Av. Paulista, 1000 - Bela Vista, São Paulo"
 * });
 *
 * // Also works: Just name (map apps will search)
 * openMapsWithChooser({ name: "Central Park" });
 *
 * // Last resort: Coordinates fallback
 * openMapsWithChooser({
 *   name: "Point A",
 *   lat: -23.5505,
 *   lng: -46.6333
 * });
 * ```
 */
export async function openMapsWithChooser(params: MapsParams): Promise<void> {
  if (!params.name) {
    logger.warn("[MapsUtils] openMapsWithChooser called with empty name");
    return;
  }

  const query = formatMapQuery(params);

  if (!query) {
    logger.warn("[MapsUtils] Could not build query from params", params);
    return;
  }

  logger.log("[MapsUtils] Opening maps with query:", query);

  // Android: Use geo: scheme which shows native chooser
  if (Platform.OS === "android") {
    const url = `geo:0,0?q=${safeEncode(query)}`;

    try {
      await Linking.openURL(url);
    } catch (error) {
      logger.error("[MapsUtils] Android geo: scheme failed, using web fallback", error);
      await openGoogleMapsWeb(query);
    }
    return;
  }

  // iOS: Detect available apps and show ActionSheet
  if (Platform.OS === "ios") {
    const availableApps = await getAvailableMapApps();

    logger.log("[MapsUtils] Available apps detected:", availableApps.map(a => a.key));

    if (availableApps.length === 0) {
      // No apps detected, use web fallback
      await openGoogleMapsWeb(query);
      return;
    }

    if (availableApps.length === 1) {
      // Only one app available, open directly
      const success = await openMapApp(availableApps[0], query);
      if (!success) {
        await openGoogleMapsWeb(query);
      }
      return;
    }

    // Multiple apps available, show chooser
    showMapChooserIOS(availableApps, query);
    return;
  }

  // Web or other platforms: use Google Maps web
  await openGoogleMapsWeb(query);
}

// Re-export for backwards compatibility during migration
export { openMapsWithChooser as openMaps };
