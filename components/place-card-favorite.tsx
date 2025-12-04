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

interface PlaceCardFavoriteProps {
  place: {
    id: string;
    name: string;
    type?: string;
    category: string;
    activeUsers: number;
    image?: string;
    isFavorite?: boolean;
  };
  plansCount?: number;
  onClick: () => void;
  onPlansClick?: () => void;
  onToggleFavorite?: () => void;
}

const GRADIENTS: Record<string, [string, string]> = {
  restaurant: ["#E74C3C", "#C0392B"],
  bar: ["#F39C12", "#D35400"],
  cafe: ["#8E6E53", "#5C4033"],
  nightclub: ["#8E44AD", "#2C3E50"],
  gym: ["#27AE60", "#145A32"],
  default: ["#1D9BF0", "#16181C"],
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PlaceCardFavorite({
  place,
  plansCount = 0,
  onClick,
  onPlansClick,
  onToggleFavorite,
}: PlaceCardFavoriteProps) {
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

  const gradient = GRADIENTS[place.type || place.category] || GRADIENTS.default;

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
            <IconSymbol
              name={getIconForType(place.type || place.category) as any}
              size={64}
              color="rgba(255, 255, 255, 0.9)"
            />
          </View>

          {/* Gradient overlay */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.2)", "rgba(0,0,0,0.85)"]}
            style={styles.overlay}
          />

          {/* Active users badge */}
          {place.activeUsers > 0 && (
            <View style={styles.badge}>
              <IconSymbol name="person.2.fill" size={12} color="#fff" />
              <Text style={styles.badgeText}>{place.activeUsers}</Text>
            </View>
          )}

          {/* Bottom content */}
          <View style={styles.bottomContent}>
            <View style={styles.bottomRow}>
              <ThemedText
                type="defaultSemiBold"
                style={styles.placeName}
                numberOfLines={1}
              >
                {place.name}
              </ThemedText>

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
                    size={16}
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

function getIconForType(type: string): string {
  const icons: Record<string, string> = {
    restaurant: "fork.knife",
    bar: "wineglass",
    cafe: "cup.and.saucer.fill",
    nightclub: "music.note.house.fill",
    gym: "figure.walk",
    park: "tree.fill",
    shopping_mall: "bag.fill",
    default: "mappin.circle.fill",
  };
  return icons[type] || icons.default;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: "hidden",
  },
  cardInner: {
    backgroundColor: "#16181C",
    borderRadius: 16,
    overflow: "hidden",
  },
  gradientBackground: {
    height: 160,
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
    top: 8,
    right: 8,
    backgroundColor: "#1D9BF0",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
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
    padding: 12,
    zIndex: 10,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
  },
  placeName: {
    color: "#fff",
    fontSize: 14,
    flex: 1,
  },
  favoriteButton: {
    width: 32,
    height: 32,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
});
