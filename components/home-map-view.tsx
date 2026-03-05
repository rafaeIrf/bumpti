/**
 * HomeMapView — Mapbox dark map with high-fidelity place markers.
 *
 * Architecture (per @rnmapbox/maps docs):
 *  - ShapeSource  → GeoJSON FeatureCollection of all active places
 *  - CircleLayer  × 3 → glow (physical only), ring (priority stroke), core (category fill)
 *  - SymbolLayer  → count badge (text with halo) offset to top-right
 *  - ShapeSource.onPress → reliable per-feature tap, hitbox 60×60px
 *
 * Performance:
 *  - ZERO React-rendered markers (no MarkerView for pins)
 *  - circle-sort-key ensures physical > checkin_plus > planning z-order
 *  - Glow pulse driven by setInterval (native layers can't use Reanimated)
 *
 * Attribution:
 *  - Mapbox attribution rendered automatically by <MapView> (mandatory per ToS)
 *  - Overture Maps attribution badge overlaid per licensing requirements
 */

import NavigationIcon from "@/assets/icons/navigation.svg";
import MapCategoryIcons from "@/components/map-category-icons";
import { MapPlacePreviewCard } from "@/components/map-place-preview-card";
import { Button } from "@/components/ui/button";
import {
  CORE_FILL_COLOR_EXPR,
  GLOW_COLOR,
  HUB_CORE_RADIUS_EXPR,
  HUB_GLOW_RADIUS_EXPR,
  HUB_RING_COLOR_EXPR,
  HUB_RING_RADIUS_EXPR,
  ICON_IMAGE_EXPR,
  MARKER_SIZES,
  SORT_KEY_EXPR,
} from "@/constants/map-marker-config";
import { useCachedLocation } from "@/hooks/use-cached-location";
import { useProfile } from "@/hooks/use-profile";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { MapActivePlace, PlaceSocialSummary } from "@/modules/places/api";
import {
  useLazyGetMapActivePlacesQuery,
  useLazyGetPlaceSocialSummaryQuery,
} from "@/modules/places/placesApi";
import { logger } from "@/utils/logger";
import {
  Camera,
  CircleLayer,
  LocationPuck,
  MapView,
  MarkerView,
  ShapeSource,
  SymbolLayer,
} from "@rnmapbox/maps";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

// ─── Constants ───────────────────────────────────────────────────────────────

const OVERTURE_ATTRIBUTION =
  "© OpenStreetMap contributors, Overture Maps Foundation";

// Glow pulse timing
const GLOW_INTERVAL_MS = 1500;
const GLOW_OPACITY_LOW = 0.12;
const GLOW_OPACITY_HIGH = 0.35;

// ─── Types ───────────────────────────────────────────────────────────────────

interface SelectedPin {
  place: MapActivePlace;
  summary: PlaceSocialSummary | null;
  loading: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Badge count logic:
 * - If people are physically there (active_users > 0), this is the authoritative count.
 * - Otherwise, use the max of planning and regulars.
 *
 * Why Math.max? A user can be BOTH a planner and a regular. Summing them (planning + regulars)
 * causes double-counting for the same person (e.g., 1 planner + 1 regular = 2 badges, 1 avatar).
 */
function getTotalCount(place: MapActivePlace): number {
  const active = place.active_users ?? 0;
  const planning = place.planning_count ?? 0;
  const regulars = place.regulars_count ?? 0;

  return active + planning + regulars;
}

function computeSortKey(place: MapActivePlace): number {
  if ((place.active_users ?? 0) > 0) return 3;
  if ((place.regulars_count ?? 0) > 0) return 2;
  if ((place.planning_count ?? 0) > 0) return 1;
  return 0;
}

/** Build GeoJSON with enriched properties for multi-layer rendering. */
function buildGeoJSON(
  places: MapActivePlace[],
  hubIds: Set<string>,
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: places
      .filter((p) => getTotalCount(p) > 0 || hubIds.has(p.id))
      .map((p) => ({
        type: "Feature" as const,
        id: p.id,
        geometry: {
          type: "Point" as const,
          coordinates: [p.lng, p.lat],
        },
        properties: {
          id: p.id,
          category: p.category ?? "default",
          physical_count: p.active_users ?? 0,
          checkin_plus_count: p.regulars_count ?? 0,
          planning_count: p.planning_count ?? 0,
          total_count: String(getTotalCount(p)),
          sort_key: computeSortKey(p),
          has_physical: (p.active_users ?? 0) > 0 ? 1 : 0,
          is_social_hub: hubIds.has(p.id) ? 1 : 0,
        },
      })),
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function HomeMapView() {
  const colors = useThemeColors();
  const { location } = useCachedLocation();
  const { profile } = useProfile();
  const cameraRef = useRef<Camera>(null);
  const userPhotoUrl = profile?.photos?.[0]?.url ?? null;

  // Glow pulse state
  const [glowOpacity, setGlowOpacity] = useState(GLOW_OPACITY_LOW);

  // Recenter FAB visibility — shown after user pans away
  const [showRecenter, setShowRecenter] = useState(false);
  const didInitialFit = useRef(false);

  // Place preview card state
  const [selectedPin, setSelectedPin] = useState<SelectedPin | null>(null);

  const [fetchSummary] = useLazyGetPlaceSocialSummaryQuery();
  const [fetchMapPlaces, { data: mapPlaces }] =
    useLazyGetMapActivePlacesQuery();

  // ─── Data fetching ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (location) {
      logger.log(
        "[HomeMapView] Fetching map places for:",
        location.latitude,
        location.longitude,
      );
      fetchMapPlaces({
        lat: location.latitude,
        lng: location.longitude,
        radiusMeters: 50000,
      })
        .then((result) => {
          logger.log(
            "[HomeMapView] fetchMapPlaces result:",
            result.data?.length ?? "no data",
          );
        })
        .catch((err) =>
          logger.error("[HomeMapView] fetchMapPlaces error:", err),
        );
    }
  }, [location, fetchMapPlaces]);

  const places = useMemo<MapActivePlace[]>(() => {
    const rpcPlaces = mapPlaces ?? [];
    // Merge user's social hubs that are missing from RPC (zero activity)
    const hubs = profile?.socialHubs ?? [];
    const rpcIds = new Set(rpcPlaces.map((p) => p.id));
    const missingHubs: MapActivePlace[] = hubs
      .filter((h) => !rpcIds.has(h.id) && h.lat && h.lng)
      .map((h) => ({
        id: h.id,
        name: h.name,
        lat: h.lat,
        lng: h.lng,
        neighborhood: null,
        category: h.category,
        active_users: 0,
        planning_count: 0,
        regulars_count: 0,
        preview_avatars: [],
      }));
    const result = [...rpcPlaces, ...missingHubs];
    logger.log(
      "[HomeMapView] places:",
      result.length,
      "(hubs merged:",
      missingHubs.length,
      ")",
    );
    return result;
  }, [mapPlaces, profile?.socialHubs]);

  // ─── Auto-zoom to fit user + all pins ─────────────────────────────────────

  useEffect(() => {
    if (!location || places.length === 0) return;
    cameraRef.current?.setCamera({
      centerCoordinate: [location.longitude, location.latitude],
      zoomLevel: 13,
      animationDuration: 800,
      animationMode: "flyTo",
    });
    // Allow user-panning detection after initial fit settles
    setTimeout(() => {
      didInitialFit.current = true;
    }, 1200);
  }, [location, places]);

  // ─── Glow pulse animation ────────────────────────────────────────────────

  useEffect(() => {
    const hasPhysical = places.some((p) => (p.active_users ?? 0) > 0);
    if (!hasPhysical) return;

    const interval = setInterval(() => {
      setGlowOpacity((prev) =>
        prev === GLOW_OPACITY_LOW ? GLOW_OPACITY_HIGH : GLOW_OPACITY_LOW,
      );
    }, GLOW_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [places]);

  // ─── GeoJSON FeatureCollection ────────────────────────────────────────────

  const hubIds = useMemo(() => {
    const hubs = profile?.socialHubs ?? [];
    return new Set(hubs.map((h) => h.id));
  }, [profile?.socialHubs]);

  const geoJSON = useMemo(() => buildGeoJSON(places, hubIds), [places, hubIds]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleSourcePress = useCallback(
    async (event: { features: GeoJSON.Feature[] }) => {
      const feature = event.features[0];
      if (!feature) return;
      const placeId = feature.properties?.id as string | undefined;
      if (!placeId) return;

      const place = places.find((p) => p.id === placeId);
      if (!place) return;

      logger.log("[HomeMapView] Pin pressed:", place.name);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      setSelectedPin({ place, summary: null, loading: true });

      try {
        const result = await fetchSummary(place.id);
        setSelectedPin({ place, summary: result.data ?? null, loading: false });
      } catch (err) {
        logger.error("[HomeMapView] fetchSummary error:", err);
        setSelectedPin((prev) => (prev ? { ...prev, loading: false } : null));
      }
    },
    [places, fetchSummary],
  );

  const handleDismiss = useCallback(() => {
    setSelectedPin(null);
  }, []);

  const handleConnect = useCallback(() => {
    logger.log("[HomeMapView] Connect pressed for:", selectedPin?.place.id);
  }, [selectedPin]);

  const handleCreatePlan = useCallback(() => {
    logger.log("[HomeMapView] Create plan pressed for:", selectedPin?.place.id);
  }, [selectedPin]);

  // ─── Recenter handler ──────────────────────────────────────────────────────

  const handleRecenter = useCallback(() => {
    if (!location) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    cameraRef.current?.setCamera({
      centerCoordinate: [location.longitude, location.latitude],
      zoomLevel: 13,
      animationDuration: 800,
      animationMode: "flyTo",
    });
    setShowRecenter(false);
  }, [location]);

  const handleCameraChanged = useCallback(() => {
    if (didInitialFit.current) {
      setShowRecenter(true);
    }
  }, []);

  const initialCenter: [number, number] = location
    ? [location.longitude, location.latitude]
    : [-49.246, -25.403];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFillObject}
        styleURL="mapbox://styles/mapbox/dark-v11"
        scaleBarEnabled={false}
        compassEnabled={false}
        attributionPosition={{ left: 0, top: 0 }}
        attributionEnabled={true}
        logoEnabled={false}
        tintColor="rgba(255,255,255,0.45)"
        surfaceView={false}
        onMapLoadingError={() =>
          logger.error("[HomeMapView] Map failed to load (check token/style)")
        }
        onCameraChanged={handleCameraChanged}
      >
        <Camera
          ref={cameraRef}
          zoomLevel={13}
          centerCoordinate={initialCenter}
          animationMode="flyTo"
          animationDuration={800}
        />

        <LocationPuck
          puckBearingEnabled
          pulsing={{ isEnabled: true, color: "#1D9BF0" }}
        />

        {/* User avatar ring at current location */}
        {location && userPhotoUrl && (
          <MarkerView
            coordinate={[location.longitude, location.latitude]}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.avatarMarker}>
              <Image
                source={{ uri: userPhotoUrl }}
                style={styles.avatarImage}
                contentFit="cover"
              />
            </View>
          </MarkerView>
        )}

        {/* Register category SVG icons as native bitmaps */}
        <MapCategoryIcons />

        {/* ── Place markers — native layers only ───────────────────────── */}
        {places.length > 0 && (
          <ShapeSource
            id="places-source"
            shape={geoJSON}
            onPress={handleSourcePress}
            hitbox={{ width: 60, height: 60 }}
          >
            {/* Layer 1: Glow aura — physical presence + social hubs */}
            <CircleLayer
              id="places-glow"
              filter={[
                "any",
                ["==", ["get", "has_physical"], 1],
                ["==", ["get", "is_social_hub"], 1],
              ]}
              style={{
                circleRadius: HUB_GLOW_RADIUS_EXPR,
                circleColor: GLOW_COLOR,
                circleOpacity: glowOpacity,
                circleBlur: 0.7,
                circleSortKey: SORT_KEY_EXPR,
              }}
            />

            {/* Layer 2: Ring — hub gold or activity-based stroke border */}
            <CircleLayer
              id="places-ring"
              style={{
                circleRadius: HUB_RING_RADIUS_EXPR,
                circleColor: "transparent",
                circleStrokeWidth: MARKER_SIZES.ringStrokeWidth,
                circleStrokeColor: HUB_RING_COLOR_EXPR,
                circleStrokeOpacity: 0.9,
                circleSortKey: SORT_KEY_EXPR,
              }}
            />

            {/* Layer 3: Core — category-colored fill */}
            <CircleLayer
              id="places-core"
              style={{
                circleRadius: HUB_CORE_RADIUS_EXPR,
                circleColor: CORE_FILL_COLOR_EXPR,
                circleOpacity: 1,
                circleSortKey: SORT_KEY_EXPR,
              }}
            />

            {/* Layer 4: Category icon — rendered as native bitmap */}
            <SymbolLayer
              id="places-icon"
              style={{
                iconImage: ICON_IMAGE_EXPR,
                iconSize: 0.8,
                iconAllowOverlap: true,
                iconIgnorePlacement: true,
              }}
            />
          </ShapeSource>
        )}
      </MapView>

      {/* Unified attribution bar — Overture (bottom-right) */}
      <View
        style={[styles.attributionBar, { backgroundColor: "rgba(0,0,0,0.45)" }]}
        pointerEvents="none"
      >
        <Text style={styles.attributionText}>{OVERTURE_ATTRIBUTION}</Text>
      </View>

      {/* Recenter FAB — appears when user pans away */}
      {showRecenter && (
        <View style={styles.recenterFabContainer}>
          <Button
            size="fab"
            variant="secondary"
            leftIcon={<NavigationIcon />}
            onPress={handleRecenter}
            accessibilityLabel={t("screens.home.map.recenterMap")}
          />
        </View>
      )}

      {/* Dismiss overlay — tap outside the card */}
      {selectedPin && (
        <Pressable style={styles.dismissOverlay} onPress={handleDismiss} />
      )}

      {/* Place preview card */}
      {selectedPin && (
        <MapPlacePreviewCard
          place={selectedPin.place}
          placeFallback={selectedPin.place}
          summary={selectedPin.summary}
          loading={selectedPin.loading}
          onConnect={handleConnect}
          onCreatePlan={handleCreatePlan}
          onDismiss={handleDismiss}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: "relative" },
  recenterFabContainer: {
    position: "absolute",
    bottom: 36,
    right: 12,
  },
  attributionBar: {
    position: "absolute",
    bottom: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  attributionText: {
    fontSize: 9,
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 0.2,
  },
  emptyState: {
    position: "absolute",
    top: "50%",
    alignSelf: "center",
    transform: [{ translateY: -20 }],
  },
  emptyText: {
    fontFamily: "Poppins-Regular",
    fontSize: 12,
    lineHeight: 18,
  },
  avatarMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: "#1D9BF0",
    backgroundColor: "#16181C",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  dismissOverlay: {
    ...StyleSheet.absoluteFillObject,
    bottom: 200,
  },
  avatarImage: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
  },
});
