import { CalendarIcon } from "@/assets/icons";
import { spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const ACTIVE_COLOR = "#1D9BF0";
const PIN_SIZE = 40;
const GLOW_SIZE = 56;

// ──────────────────────────────────────────────
// Active pin — blue glow + user count badge
// ──────────────────────────────────────────────
function ActivePin({ count }: { count: number }) {
  const glowOpacity = useSharedValue(0.6);

  useEffect(() => {
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900 }),
        withTiming(0.4, { duration: 900 }),
      ),
      -1,
      true,
    );
    // glowOpacity is a Reanimated SharedValue (stable ref) — intentionally omitted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const label = count > 99 ? "99+" : String(count);

  return (
    <View style={styles.activeWrapper}>
      {/* Pulsing glow ring */}
      <Animated.View
        style={[styles.glow, { backgroundColor: ACTIVE_COLOR }, glowStyle]}
      />
      {/* Pin body */}
      <View style={[styles.pinBody, { backgroundColor: ACTIVE_COLOR }]}>
        <Text style={styles.countLabel}>{label}</Text>
      </View>
    </View>
  );
}

// ──────────────────────────────────────────────
// Planning pin — translucent grey with calendar
// ──────────────────────────────────────────────
function PlanningPin({ count }: { count: number }) {
  const colors = useThemeColors();
  const label = count > 99 ? "99+" : String(count);
  return (
    <View style={styles.activeWrapper}>
      <View
        style={[
          styles.pinBody,
          styles.planningBody,
          { backgroundColor: colors.surface + "CC" },
        ]}
      >
        <CalendarIcon width={16} height={16} color={colors.textSecondary} />
        <Text
          style={[
            styles.countLabel,
            { color: colors.textSecondary, fontSize: 10 },
          ]}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────
interface MapPlacePinProps {
  /** active — blue glow (people physically here now) */
  /** planning — translucent grey (only future plans) */
  variant: "active" | "planning";
  count: number;
}

export function MapPlacePin({ variant, count }: MapPlacePinProps) {
  if (variant === "active") return <ActivePin count={count} />;
  return <PlanningPin count={count} />;
}

const styles = StyleSheet.create({
  activeWrapper: {
    alignItems: "center",
    justifyContent: "center",
    width: GLOW_SIZE,
    height: GLOW_SIZE,
  },
  glow: {
    position: "absolute",
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    borderRadius: GLOW_SIZE / 2,
  },
  pinBody: {
    width: PIN_SIZE,
    height: PIN_SIZE,
    borderRadius: PIN_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: ACTIVE_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  planningBody: {
    flexDirection: "row",
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  countLabel: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 16,
  },
});
