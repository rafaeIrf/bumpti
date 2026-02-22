/**
 * HomeMapView — Mapbox dark map with semantic place pins.
 *
 * Architecture (per @rnmapbox/maps docs):
 *  - ShapeSource  → GeoJSON FeatureCollection of all active places
 *  - CircleLayer  → native circle per place (touch-enabled)
 *  - SymbolLayer  → count badge text on top of each circle
 *  - ShapeSource.onPress → reliable per-feature tap, hitbox 60x60px
 *
 * The MarkerView / Pressable combo is intentionally avoided — the Pressable
 * inside view annotations doesn't receive touches reliably on Android.
 *
 * Attribution:
 *  - Mapbox attribution is rendered automatically by <MapView> (mandatory per ToS).
 *  - Overture Maps attribution badge is overlaid per Overture licensing requirements.
 *    (Places data: Meta, Microsoft, Foursquare — CDLA Permissive 2.0 / Apache 2.0)
 */

import { MapPlacePreviewCard } from "@/components/map-place-preview-card";
import { spacing, typography } from "@/constants/theme";
import { useCachedLocation } from "@/hooks/use-cached-location";
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
  MapView,
  ShapeSource,
  SymbolLayer,
  UserLocation,
} from "@rnmapbox/maps";
import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

// Overture Maps Places attribution text (required by their licensing terms)
const OVERTURE_ATTRIBUTION = "© Overture Maps (Meta, Microsoft, Foursquare)";

// Pin colors
const ACTIVE_COLOR = "#1D9BF0";
const PLANNING_COLOR = "#5B6671";

// ─── Types ───────────────────────────────────────────────────────────────────
interface SelectedPin {
  place: MapActivePlace;
  summary: PlaceSocialSummary | null;
  loading: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getPinVariant(place: MapActivePlace): "active" | "planning" | null {
  if ((place.active_users ?? 0) > 0) return "active";
  if ((place.planning_count ?? 0) > 0) return "planning";
  if ((place.regulars_count ?? 0) > 0) return "planning";
  return null;
}

function getPinCount(place: MapActivePlace): number {
  return (
    (place.active_users ?? 0) +
    (place.planning_count ?? 0) +
    (place.regulars_count ?? 0)
  );
}

/** Build a GeoJSON FeatureCollection from active places */
function buildGeoJSON(places: MapActivePlace[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: places
      .filter((p) => getPinVariant(p) !== null)
      .map((p) => ({
        type: "Feature",
        id: p.id,
        geometry: {
          type: "Point",
          coordinates: [p.lng, p.lat],
        },
        properties: {
          id: p.id,
          variant: getPinVariant(p),
          count: String(getPinCount(p)),
          circleColor:
            getPinVariant(p) === "active" ? ACTIVE_COLOR : PLANNING_COLOR,
        },
      })),
  };
}

// ─── Component ───────────────────────────────────────────────────────────────
export function HomeMapView() {
  const colors = useThemeColors();
  const { location } = useCachedLocation();
  const cameraRef = useRef<Camera>(null);

  const [selectedPin, setSelectedPin] = useState<SelectedPin | null>(null);

  const [fetchSummary] = useLazyGetPlaceSocialSummaryQuery();
  const [fetchMapPlaces, { data: mapPlaces }] =
    useLazyGetMapActivePlacesQuery();

  // Fetch active places whenever location becomes available
  React.useEffect(() => {
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
    const result = mapPlaces ?? [];
    logger.log("[HomeMapView] places:", result.length);
    return result;
  }, [mapPlaces]);

  // Auto-zoom to fit user + all pins
  React.useEffect(() => {
    if (!location || places.length === 0) return;
    const allLngs = [location.longitude, ...places.map((p) => p.lng)];
    const allLats = [location.latitude, ...places.map((p) => p.lat)];
    const sw: [number, number] = [Math.min(...allLngs), Math.min(...allLats)];
    const ne: [number, number] = [Math.max(...allLngs), Math.max(...allLats)];
    cameraRef.current?.fitBounds(ne, sw, [80, 80, 120, 80], 800);
  }, [location, places]);

  // GeoJSON FeatureCollection — rebuilt whenever places change
  const geoJSON = useMemo(() => buildGeoJSON(places), [places]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handlePinPress = useCallback(
    async (place: MapActivePlace) => {
      logger.log("[HomeMapView] Pin pressed:", place.name);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      cameraRef.current?.setCamera({
        centerCoordinate: [place.lng, place.lat],
        zoomLevel: 15,
        animationDuration: 400,
      });

      setSelectedPin({ place, summary: null, loading: true });

      try {
        const result = await fetchSummary(place.id);
        logger.log(
          "[HomeMapView] fetchSummary result:",
          JSON.stringify(result.data),
        );
        setSelectedPin({ place, summary: result.data ?? null, loading: false });
      } catch (err) {
        logger.error("[HomeMapView] fetchSummary error:", err);
        setSelectedPin((prev) => (prev ? { ...prev, loading: false } : null));
      }
    },
    [fetchSummary],
  );

  // ShapeSource.onPress — receives exact feature tapped (native, not coordinate guessing)
  const handleSourcePress = useCallback(
    (event: { features: GeoJSON.Feature[] }) => {
      const feature = event.features[0];
      if (!feature) return;
      const placeId = feature.properties?.id as string | undefined;
      if (!placeId) return;

      const place = places.find((p) => p.id === placeId);
      if (place) handlePinPress(place);
    },
    [places, handlePinPress],
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

  const initialCenter: [number, number] = location
    ? [location.longitude, location.latitude]
    : [-49.246, -25.403];

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFillObject}
        styleURL="mapbox://styles/mapbox/dark-v11"
        scaleBarEnabled={false}
        compassEnabled={false}
        attributionEnabled={true}
        attributionPosition={{ bottom: 40, right: 8 }}
        surfaceView={false}
        onPress={handleDismiss}
        onDidFailLoadingMap={() =>
          logger.error("[HomeMapView] Map failed to load (check token/style)")
        }
      >
        <Camera
          ref={cameraRef}
          zoomLevel={13}
          centerCoordinate={initialCenter}
          animationMode="flyTo"
          animationDuration={800}
        />

        <UserLocation visible={true} />

        {/* ShapeSource + CircleLayer + SymbolLayer
            onPress on ShapeSource is the official way to detect feature taps.
            hitbox 60x60 gives a generous finger-friendly hit area.     */}
        {places.length > 0 && (
          <ShapeSource
            id="places-source"
            shape={geoJSON}
            onPress={handleSourcePress}
            hitbox={{ width: 60, height: 60 }}
          >
            {/* Circle body */}
            <CircleLayer
              id="places-circle"
              style={{
                circleRadius: 20,
                circleColor: ["get", "circleColor"],
                circleOpacity: 0.9,
                circleStrokeWidth: 2,
                circleStrokeColor: [
                  "case",
                  ["==", ["get", "variant"], "active"],
                  "rgba(29,155,240,0.3)",
                  "rgba(91,102,113,0.3)",
                ],
              }}
            />
            {/* Count badge */}
            <SymbolLayer
              id="places-count"
              style={{
                textField: ["get", "count"],
                textSize: 13,
                textColor: "#ffffff",
                textFont: ["DIN Offc Pro Bold", "Arial Unicode MS Bold"],
                textAllowOverlap: true,
                textIgnorePlacement: true,
              }}
            />
          </ShapeSource>
        )}
      </MapView>

      {/* Overture Maps attribution */}
      <View
        style={[
          styles.overtureAttribution,
          { backgroundColor: colors.surface + "CC" },
        ]}
        pointerEvents="none"
      >
        <Text
          style={[
            typography.caption,
            { color: colors.textSecondary, fontSize: 9 },
          ]}
        >
          {OVERTURE_ATTRIBUTION}
        </Text>
      </View>

      {/* Empty state */}
      {places.length === 0 && (
        <View style={styles.emptyState} pointerEvents="none">
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            {t("screens.home.map.comingSoon")}
          </Text>
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
  container: { flex: 1 },
  overtureAttribution: {
    position: "absolute",
    bottom: 40,
    left: 0,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  emptyState: {
    position: "absolute",
    top: "50%",
    alignSelf: "center",
    transform: [{ translateY: -20 }],
  },
  dismissOverlay: {
    ...StyleSheet.absoluteFillObject,
    bottom: 200, // don't cover the card at the bottom
  },
});
