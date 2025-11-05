import { getPlaceGradient, getPlaceIcon } from "@/components/place-card-utils";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

interface PlaceCardLargeProps {
  place: {
    id: string;
    name: string;
    type: string;
    category: string;
    distance: number;
    activeUsers: number;
    image?: string;
    userPreviews?: string[];
    isFavorite?: boolean;
  };
  plansCount?: number;
  onClick: () => void;
  onPlansClick?: () => void;
  onToggleFavorite?: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PlaceCardLarge({
  place,
  plansCount = 0,
  onClick,
  onPlansClick,
  onToggleFavorite,
}: PlaceCardLargeProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const gradient = getPlaceGradient(place.type);
  const Icon = getPlaceIcon(place.type);

  return (
    <AnimatedPressable
      onPress={onClick}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.card, animatedStyle]}
    >
      <View style={styles.cardInner}>
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBackground}
        >
          {/* Centered icon */}
          <View style={styles.iconContainer}>
            <Icon width={96} height={96} color="rgba(255, 255, 255, 0.9)" />
          </View>

          {/* Gradient overlay */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.9)"]}
            style={styles.overlay}
          />

          {/* Active users badge */}
          {place.activeUsers > 0 && (
            <View style={styles.badge}>
              <IconSymbol name="person.2.fill" size={14} color="#fff" />
              <Text style={styles.badgeText}>{place.activeUsers}</Text>
            </View>
          )}

          {/* Bottom content */}
          <View style={styles.bottomContent}>
            <View style={styles.infoContainer}>
              <View style={styles.textContainer}>
                <ThemedText type="defaultSemiBold" style={styles.placeName}>
                  {place.name}
                </ThemedText>
                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>{place.type}</Text>
                  <Text style={styles.metaText}>•</Text>
                  <Text style={styles.metaText}>
                    {place.distance.toFixed(1)}km
                  </Text>
                </View>
              </View>

              {/* Favorite button */}
              {onToggleFavorite && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    onToggleFavorite();
                  }}
                  style={styles.favoriteButton}
                >
                  <IconSymbol
                    name={place.isFavorite ? "heart.fill" : "heart"}
                    size={20}
                    color={place.isFavorite ? "#FF453A" : "#fff"}
                  />
                </Pressable>
              )}
            </View>
          </View>
        </LinearGradient>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
  },
  cardInner: {
    backgroundColor: "#16181C",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2F3336",
    overflow: "hidden",
  },
  gradientBackground: {
    height: 224,
    position: "relative",
  },
  iconContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  badge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "#1D9BF0",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    zIndex: 10,
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  bottomContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    zIndex: 10,
  },
  infoContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  textContainer: {
    flex: 1,
    minWidth: 0,
  },
  placeName: {
    color: "#fff",
    fontSize: 18,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaText: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.7)",
  },
  favoriteButton: {
    width: 40,
    height: 40,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
