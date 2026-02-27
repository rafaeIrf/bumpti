import {
  AwardIcon,
  BeerIcon,
  BookOpenIcon,
  BuildingIcon,
  CoffeeIcon,
  DumbbellIcon,
  GlobeIcon,
  GraduationCapIcon,
  HotelIcon,
  MapPinIcon,
  MartiniIcon,
  MusicIcon,
  ShoppingBagIcon,
  TreeIcon,
  TreesIcon,
  UsersIcon,
  UtensilsCrossedIcon
} from "@/assets/icons";
import { ComponentType } from "react";
import { SvgProps } from "react-native-svg";

// ─── Category → Icon ───────────────────────────────────────────────────────────
export const PLACE_ICON_MAP: Record<
  string,
  ComponentType<SvgProps>
> = {
  restaurant: UtensilsCrossedIcon,
  bar: BeerIcon,
  cafe: CoffeeIcon,
  nightclub: MartiniIcon,
  gym: DumbbellIcon,
  park: TreesIcon,
  university: GraduationCapIcon,
  shopping: ShoppingBagIcon,
  club: DumbbellIcon,
  sports_centre: DumbbellIcon,
  skate_park: TreeIcon,
  stadium: AwardIcon,
  event_venue: MusicIcon,
  hotel: HotelIcon,
  theatre: MusicIcon,
  museum: BuildingIcon,
  library: BookOpenIcon,
  plaza: TreesIcon,
  community_centre: UsersIcon,
  language_school: GlobeIcon,
  default: MapPinIcon,
};

// ─── Category → BrandIcon background color ────────────────────────────────────
// Colors match the pastel palette used in the home screen category cards.
export const PLACE_CATEGORY_COLOR_MAP: Record<string, string> = {
  restaurant: "#A1887F", // pastelCocoa
  bar: "#9575CD",        // pastelPurple
  cafe: "#A1887F",       // pastelCocoa
  nightclub: "#9575CD",  // pastelPurple
  gym: "#64B5F6",        // pastelBlue
  park: "#4DB6AC",       // pastelTeal
  university: "#64B5F6", // pastelBlue
  shopping: "#64B5F6",   // pastelBlue
  club: "#4DB6AC",       // pastelTeal
  sports_centre: "#4DB6AC", // pastelTeal
  skate_park: "#4DB6AC", // pastelTeal
  stadium: "#9575CD",    // pastelPurple
  event_venue: "#9575CD", // pastelPurple
  hotel: "#9575CD",      // pastelPurple
  theatre: "#9575CD",    // pastelPurple
  museum: "#64B5F6",     // pastelBlue
  library: "#64B5F6",    // pastelBlue
  plaza: "#4DB6AC",      // pastelTeal
  community_centre: "#4DB6AC", // pastelTeal
  language_school: "#64B5F6",  // pastelBlue
  default: "#64B5F6",    // pastelBlue
};

// ─── Gradients (used by place-card-large / place-card-icon) ───────────────────
export const PLACE_GRADIENTS: Record<string, [string, string]> = {
  restaurant: ["#E74C3C", "#C0392B"],
  bar: ["#F39C12", "#D35400"],
  cafe: ["#8E6E53", "#5C4033"],
  nightclub: ["#8E44AD", "#2C3E50"],
  gym: ["#27AE60", "#145A32"],
  default: ["#1D9BF0", "#16181C"],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns the SVG icon component for a place tag/category.
 */
export const getPlaceIcon = (
  type: string
): ComponentType<SvgProps> => {
  return PLACE_ICON_MAP[type] ?? PLACE_ICON_MAP.default;
};

/**
 * Returns the BrandIcon background color for a place tag/category.
 */
export const getCategoryColor = (type: string): string => {
  return PLACE_CATEGORY_COLOR_MAP[type] ?? PLACE_CATEGORY_COLOR_MAP.default;
};

/**
 * Returns the gradient colors for a place type (used by card-large / icon variants).
 */
export const getPlaceGradient = (type: string): [string, string] => {
  return PLACE_GRADIENTS[type] ?? PLACE_GRADIENTS.default;
};
