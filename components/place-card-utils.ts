import {
    BeerIcon,
    CoffeeIcon,
    DumbbellIcon,
    MapPinIcon,
    MusicIcon,
    ShoppingBagIcon,
    UtensilsCrossedIcon,
} from "@/assets/icons";

// Gradientes por tipo de lugar
export const PLACE_GRADIENTS: Record<string, [string, string]> = {
  restaurant: ["#E74C3C", "#C0392B"],
  bar: ["#F39C12", "#D35400"],
  cafe: ["#8E6E53", "#5C4033"],
  nightclub: ["#8E44AD", "#2C3E50"],
  gym: ["#27AE60", "#145A32"],
  default: ["#1D9BF0", "#16181C"],
};

// Mapeamento de ícones SVG por tipo
export const PLACE_ICON_MAP: Record<
  string,
  React.ComponentType<{ width: number; height: number; color: string }>
> = {
  restaurant: UtensilsCrossedIcon,
  bar: BeerIcon,
  pub: BeerIcon,
  cafe: CoffeeIcon,
  coffee_shop: CoffeeIcon,
  nightclub: MusicIcon,
  nightclub: MusicIcon,
  gym: DumbbellIcon,
  fitness_center: DumbbellIcon,
  shopping_mall: ShoppingBagIcon,
  store: ShoppingBagIcon,
  default: MapPinIcon,
};

/**
 * Retorna o gradiente apropriado para um tipo de lugar
 */
export const getPlaceGradient = (type: string): [string, string] => {
  return PLACE_GRADIENTS[type] || PLACE_GRADIENTS.default;
};

/**
 * Retorna o ícone SVG apropriado para um tipo de lugar
 */
export const getPlaceIcon = (
  type: string
): React.ComponentType<{ width: number; height: number; color: string }> => {
  return PLACE_ICON_MAP[type] || PLACE_ICON_MAP.default;
};
