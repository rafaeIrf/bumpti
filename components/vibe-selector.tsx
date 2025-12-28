import { spacing } from "@/constants/theme";
import { t } from "@/modules/locales";
import { PLACE_VIBES, PlaceVibe } from "@/modules/places/types";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "./ui/button";

interface VibeSelectorProps {
  selectedVibes: PlaceVibe[];
  onToggleVibe: (vibe: PlaceVibe) => void;
}

export function VibeSelector({
  selectedVibes,
  onToggleVibe,
}: VibeSelectorProps) {
  return (
    <View style={styles.container}>
      {PLACE_VIBES.map((vibe) => {
        const isSelected = selectedVibes.includes(vibe);
        return (
          <Button
            key={vibe}
            variant={isSelected ? "default" : "outline"}
            size="sm"
            onPress={() => onToggleVibe(vibe)}
            style={[
              styles.chip,
              isSelected
                ? {
                    // Match background color for border to keep size consistent but look "borderless"
                    backgroundColor: "#2997FF",
                    borderColor: "#2997FF",
                  }
                : {
                    backgroundColor: "#1C1C1C",
                    borderColor: "#333333",
                  },
            ]}
            textStyle={styles.chipText}
          >
            {t(`place.vibes.${vibe}`)}
          </Button>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "center",
  },
  chip: {
    borderRadius: 50,
    borderWidth: 1, // Ensure consistent size across states
  },
  chipText: {
    fontWeight: "500",
  },
});
