import { SparklesIcon } from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { Chip } from "@/components/ui/chip";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import React from "react";
import {
  Image,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

import { typography } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";

interface PotentialConnectionsBannerProps {
  count: number;
  profilePhotos: string[];
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export function PotentialConnectionsBanner({
  count,
  profilePhotos,
  onPress,
  style,
}: PotentialConnectionsBannerProps) {
  const colors = useThemeColors();

  return (
    <Pressable onPress={onPress} style={style}>
      <LinearGradient
        colors={[
          (colors as any).cardGradientStart ?? colors.surface,
          (colors as any).cardGradientEnd ?? colors.surface,
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.banner}
      >
        {/* Left: Floating photo stack */}
        <View style={styles.photoStack}>
          {profilePhotos?.slice(0, 2).map((photo, index) => (
            <View
              key={index}
              style={[
                styles.photoContainer,
                {
                  zIndex: 2 - index,
                  transform: [
                    { rotate: index === 0 ? "-6deg" : "6deg" },
                    { translateX: index === 0 ? -2 : 4 },
                  ],
                },
              ]}
            >
              <Image
                source={{ uri: photo }}
                style={styles.photoImage}
                blurRadius={15}
              />
              {index === 0 && (
                <View style={styles.heartOverlay}>
                  <SparklesIcon width={20} height={20} color="#FFFFFF" />
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Middle: Text content */}
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <ThemedText style={styles.title}>
              {t("screens.chat.potentialConnections.title")}
            </ThemedText>
            <Chip label={`+${count}`} size="sm" />
          </View>
          <ThemedText style={styles.subtitle}>
            {t("screens.chat.potentialConnections.cta")}
          </ThemedText>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 24,
    gap: 16,
  },
  photoStack: {
    width: 52,
    height: 54,
    position: "relative",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  photoContainer: {
    position: "absolute",
    width: 40,
    height: 54,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    overflow: "hidden",
    backgroundColor: "#ccc",
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  heartOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  title: {
    ...typography.body1,
  },
  subtitle: {
    ...typography.caption,
    textDecorationLine: "underline",
  },
  arrowContainer: {
    flexShrink: 0,
    alignSelf: "center", // Center instead of top
    opacity: 0.7,
  },
});
