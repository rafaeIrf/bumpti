import { ThemedText } from "@/components/themed-text";
import { RemoteImage } from "@/components/ui/remote-image";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

interface ProfilePhotoProgressProps {
  photoUrl?: string;
  progress: number;
  onPress: () => void;
  completionText?: string;
}

export function ProfilePhotoProgress({
  photoUrl,
  progress,
  onPress,
  completionText,
}: ProfilePhotoProgressProps) {
  const colors = useThemeColors();
  const shouldShowCompletionBadge = progress < 1;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={styles.photoContainer}
    >
      <View style={[styles.photoRing, { backgroundColor: colors.surface }]}>
        <Svg width={96} height={96} style={StyleSheet.absoluteFill}>
          {/* Background circle */}
          <Circle
            cx="48"
            cy="48"
            r="44"
            stroke={(colors as any).border ?? colors.surface}
            strokeWidth="5"
            fill="none"
          />
          {/* Progress circle */}
          <Circle
            cx="48"
            cy="48"
            r="44"
            stroke={(colors as any).premiumBlue ?? colors.accent}
            strokeWidth="5"
            fill="none"
            strokeDasharray={`${2 * Math.PI * 44}`}
            strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress)}`}
            strokeLinecap="round"
            rotation="-90"
            origin="48, 48"
          />
        </Svg>
        <View style={[styles.photoTrack, { backgroundColor: colors.surface }]}>
          {photoUrl ? (
            <RemoteImage
              source={{ uri: photoUrl }}
              style={styles.photo}
              contentFit="cover"
            />
          ) : (
            <View
              style={[
                styles.photoPlaceholder,
                { backgroundColor: colors.surface },
              ]}
            />
          )}
        </View>
      </View>
      {shouldShowCompletionBadge && completionText && (
        <View
          style={[
            styles.progressBadge,
            {
              backgroundColor:
                (colors as any).cardGradientStart ?? colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <ThemedText style={[typography.captionBold, { color: colors.text }]}>
            {completionText}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  photoContainer: {
    flexShrink: 0,
  },
  photoRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  photoTrack: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photo: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  photoPlaceholder: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  progressBadge: {
    position: "absolute",
    bottom: -spacing.xs,
    alignSelf: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: spacing.lg,
    borderWidth: 1,
  },
});
