/**
 * MapCategoryIcons — registers category SVG icons as native Mapbox images.
 *
 * Uses @rnmapbox/maps `Image` component to capture each SVG as a bitmap at mount.
 * The captured bitmaps live in GPU memory and are referenced by `icon-image`
 * expressions in SymbolLayer — zero per-frame cost, 60fps rendering.
 *
 * Must be placed inside <MapView> as a sibling to ShapeSource/Layers.
 */

import { PLACE_ICON_MAP } from "@/components/place-card-utils";
import { Images, Image as MapImage } from "@rnmapbox/maps";
import React from "react";
import { View } from "react-native";

const ICON_SIZE = 18;

/** Memoized to avoid re-capturing bitmaps on every render. */
const MapCategoryIcons = React.memo(function MapCategoryIcons() {
  return (
    <Images>
      {Object.entries(PLACE_ICON_MAP).map(([category, IconComponent]) => (
        <MapImage key={`icon-${category}`} name={`icon-${category}`}>
          <View
            style={{
              width: ICON_SIZE,
              height: ICON_SIZE,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconComponent
              width={ICON_SIZE}
              height={ICON_SIZE}
              color="#FFFFFF"
              stroke="#FFFFFF"
            />
          </View>
        </MapImage>
      ))}
    </Images>
  );
});

export default MapCategoryIcons;
