/**
 * Map marker configuration — Mapbox GL expressions built from existing mappings.
 *
 * Sources:
 *   - Ring colors  → entryTypeBorderColors (constants/theme.ts)
 *   - Core colors  → PLACE_CATEGORY_COLOR_MAP (components/place-card-utils.ts)
 *   - Icon map     → PLACE_ICON_MAP (components/place-card-utils.ts)
 *
 * All expressions reference GeoJSON feature properties:
 *   physical_count, checkin_plus_count, planning_count, category
 *
 * NOTE: Mapbox GL expression types are cast to `any` because @rnmapbox/maps
 * uses a restrictive ExpressionName union that doesn't support dynamic builders.
 * This is the standard pattern in @rnmapbox/maps projects.
 */

import { PLACE_CATEGORY_COLOR_MAP } from "@/components/place-card-utils";
import { entryTypeBorderColors } from "@/constants/theme";

// ─── Ring Stroke Color ─────────────────────────────────────────────────────────
// Priority: physical > checkin_plus > planning
// Uses the exact colors from entryTypeBorderColors.

const PHYSICAL_COLOR = entryTypeBorderColors.physical;       // #81C784
const CHECKIN_PLUS_COLOR = entryTypeBorderColors.checkin_plus; // #81D4FA
const PLANNING_COLOR = entryTypeBorderColors.planning;        // #81D4FA
const FALLBACK_COLOR = "#5B6671"; // textTertiary

 
export const RING_STROKE_COLOR_EXPR: any = [
  "case",
  [">", ["get", "physical_count"], 0],
  PHYSICAL_COLOR,
  [">", ["get", "checkin_plus_count"], 0],
  CHECKIN_PLUS_COLOR,
  [">", ["get", "planning_count"], 0],
  PLANNING_COLOR,
  FALLBACK_COLOR,
];

// ─── Glow Color (only physical) ────────────────────────────────────────────────
export const GLOW_COLOR = PHYSICAL_COLOR;

// ─── Core Fill Color (category-based) ──────────────────────────────────────────
// Built from PLACE_CATEGORY_COLOR_MAP — uses ['match'] on the 'category' property.

function buildCategoryColorExpr() {
   
  const entries: any[] = ["match", ["get", "category"]];
  for (const [category, color] of Object.entries(PLACE_CATEGORY_COLOR_MAP)) {
    if (category === "default") continue;
    entries.push(category, color);
  }
  // Fallback
  entries.push(PLACE_CATEGORY_COLOR_MAP.default);
  return entries;
}

 
export const CORE_FILL_COLOR_EXPR: any = buildCategoryColorExpr();

// ─── Icon Image (category-based) ─────────────────────────────────────────────
// Maps to image keys registered by MapCategoryIcons via @rnmapbox/maps Image.
// Keys follow pattern: "icon-{category}"

function buildIconImageExpr() {
   
  const entries: any[] = ["match", ["get", "category"]];
  const categories = [
    "restaurant", "bar", "cafe", "nightclub", "gym", "park",
    "university", "shopping", "club", "sports_centre", "skate_park",
    "stadium", "event_venue", "hotel", "theatre", "museum",
    "library", "plaza", "community_centre", "language_school",
  ];
  for (const cat of categories) {
    entries.push(cat, `icon-${cat}`);
  }
  entries.push("icon-default"); // fallback
  return entries;
}

 
export const ICON_IMAGE_EXPR: any = buildIconImageExpr();
// Higher value = drawn on top. Physical > checkin_plus > planning.

 
export const SORT_KEY_EXPR: any = [
  "case",
  ["==", ["get", "is_social_hub"], 1],
  4,
  [">", ["get", "physical_count"], 0],
  3,
  [">", ["get", "checkin_plus_count"], 0],
  2,
  [">", ["get", "planning_count"], 0],
  1,
  0,
];

// ─── Layer Dimensions ──────────────────────────────────────────────────────────

export const MARKER_SIZES = {
  glowRadius: 26,
  ringRadius: 18,
  ringStrokeWidth: 2.5,
  coreRadius: 16,
  iconSize: 12,
} as const;

// ─── Social Hub — dynamic size expressions ─────────────────────────────────────
// Social hubs get larger markers so they stand out on the map.

const HUB_COLOR = "#FFD700"; // Gold ring for user's social hubs

export const HUB_RING_RADIUS_EXPR: any = [
  "case",
  ["==", ["get", "is_social_hub"], 1], 22,
  MARKER_SIZES.ringRadius,
];

export const HUB_CORE_RADIUS_EXPR: any = [
  "case",
  ["==", ["get", "is_social_hub"], 1], 19,
  MARKER_SIZES.coreRadius,
];

export const HUB_GLOW_RADIUS_EXPR: any = [
  "case",
  ["==", ["get", "is_social_hub"], 1], 30,
  MARKER_SIZES.glowRadius,
];

/** Ring color: social hubs → gold; others → activity-based. */
export const HUB_RING_COLOR_EXPR: any = [
  "case",
  ["==", ["get", "is_social_hub"], 1],
  HUB_COLOR,
  // Fallback: inline the activity-based conditions from RING_STROKE_COLOR_EXPR
  [">", ["get", "physical_count"], 0],
  PHYSICAL_COLOR,
  [">", ["get", "checkin_plus_count"], 0],
  CHECKIN_PLUS_COLOR,
  [">", ["get", "planning_count"], 0],
  PLANNING_COLOR,
  FALLBACK_COLOR,
];

// ─── Badge Styling ─────────────────────────────────────────────────────────────
// Solid accent-colored pellet at top-right with white text.

export const BADGE_STYLE = {
  textSize: 9,
  textColor: "#FFFFFF",
  haloColor: "#1D9BF0",  // accent blue — solid background
  haloWidth: 4,
  haloBlur: 0,           // sharp edges, no glow
  offset: [0.9, -0.9] as [number, number],
} as const;

