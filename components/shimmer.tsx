/**
 * Shimmer — MaskedView-based shimmer wrapper.
 * Adapts the user-provided pattern to use:
 *   - expo-linear-gradient (already installed)
 *   - theme-aware surface/border colors instead of hardcoded light grays
 *
 * Usage:
 *   <Shimmer colors={[dim, mid, bright, mid, dim]}>
 *     <View style={{ width, height, borderRadius }} />
 *   </Shimmer>
 */
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import { Animated, LayoutChangeEvent, StyleSheet, View } from "react-native";

type ShimmerProps = {
  children: React.ReactElement;
  /** Override gradient colors. Defaults to theme surface→border gradient. */
  colors?: readonly string[];
};

export default function Shimmer({
  children,
  colors: colorsProp,
}: ShimmerProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [size, setSize] = useState({ width: 0, height: 0 });

  // Pure neutral grays — no warm/cool cast that causes yellow tint.
  // #16181C = surface, peaks at #363636 (neutral gray, no color bias).
  const gradientColors =
    colorsProp ??
    ([
      "#16181C",
      "#171A1E",
      "#191C21",
      "#1A1D22",
      "#191C21",
      "#171A1E",
      "#16181C",
    ] as const);

  useEffect(() => {
    if (size.width > 0) {
      translateX.setValue(-size.width);
      Animated.loop(
        Animated.timing(translateX, {
          toValue: size.width,
          duration: 1500,
          useNativeDriver: true,
        }),
      ).start();
    }
  }, [size.width, translateX]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  };

  return (
    <View onLayout={onLayout}>
      {children}

      {size.width > 0 && size.height > 0 && (
        <MaskedView
          style={[
            StyleSheet.absoluteFill,
            { width: size.width, height: size.height },
          ]}
          maskElement={children}
        >
          <Animated.View
            style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}
          >
            <LinearGradient
              colors={gradientColors as [string, string, ...string[]]}
              locations={[0, 0.15, 0.35, 0.5, 0.65, 0.85, 1]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </MaskedView>
      )}
    </View>
  );
}
