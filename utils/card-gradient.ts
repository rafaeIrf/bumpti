/**
 * Card Gradient Utility
 *
 * Generates a 3-stop gradient color tuple from any hex color.
 * Used by home screen cards (PlaceCardFeatured, CategoryCard, MyCampusCard)
 * to create a consistent, subtle gradient effect.
 */

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.substring(0, 2), 16),
    parseInt(clean.substring(2, 4), 16),
    parseInt(clean.substring(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${clamp(r).toString(16).padStart(2, "0")}${clamp(g).toString(16).padStart(2, "0")}${clamp(b).toString(16).padStart(2, "0")}`;
}

function darken(hex: string, percent: number): string {
  const [r, g, b] = hexToRgb(hex);
  const factor = 1 - percent / 100;
  return rgbToHex(r * factor, g * factor, b * factor);
}

function lighten(hex: string, percent: number): string {
  const [r, g, b] = hexToRgb(hex);
  const factor = percent / 100;
  return rgbToHex(r + (255 - r) * factor, g + (255 - g) * factor, b + (255 - b) * factor);
}

/**
 * Returns a 3-stop gradient color tuple: [darkened, base, lightened].
 *
 * Use with `<LinearGradient>` and `locations={[0, 0.5, 1]}`.
 *
 * @param baseColor - A hex color string (e.g. "#9575CD")
 * @returns A tuple of 3 hex colors for gradient stops
 */
export function getCardGradientColors(
  baseColor: string,
): [string, string, string] {
  return [darken(baseColor, 25), baseColor, lighten(baseColor, 15)];
}
