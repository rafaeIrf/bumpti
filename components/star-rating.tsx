import { StarIcon } from "@/assets/icons";
import { spacing } from "@/constants/theme";
import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import {
  Gesture,
  GestureDetector,
  Pressable,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

interface StarRatingProps {
  rating: number;
  onRatingChange: (rating: number) => void;
  maxStars?: number;
  size?: number;
}

interface StarItemProps {
  index: number;
  rating: number;
  size: number;
  onSelect: (rating: number) => void;
}

function StarItem({ index, rating, size, onSelect }: StarItemProps) {
  const scale = useSharedValue(1);
  const starValue = index + 1;
  const isActive = starValue <= rating;

  // Animate when this star becomes the specifically selected rating
  useEffect(() => {
    if (rating === starValue) {
      scale.value = withSpring(1.3, {}, () => {
        scale.value = withSpring(1);
      });
    }
  }, [rating, starValue]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={() => onSelect(starValue)}
      style={styles.starContainer}
      hitSlop={8}
    >
      <Animated.View style={animatedStyle}>
        <StarIcon
          width={size}
          height={size}
          color={isActive ? "#FFD700" : "#333333"} // Gold for filled, Dark Grey for empty
          fill={isActive ? "#FFD700" : "none"}
          stroke={isActive ? "#FFD700" : "#444444"}
          strokeWidth={2}
        />
      </Animated.View>
    </Pressable>
  );
}

export function StarRating({
  rating,
  onRatingChange,
  maxStars = 5,
  size = 40,
}: StarRatingProps) {
  const containerRef = useRef<View>(null);
  const containerWidthStr = useSharedValue(0);

  const handleRating = (newRating: number) => {
    if (newRating !== rating) {
      onRatingChange(Math.max(1, Math.min(newRating, maxStars)));
    }
  };

  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .onBegin((e) => {
      if (containerWidthStr.value > 0) {
        const starWidth = containerWidthStr.value / maxStars;
        const newRating = Math.ceil(e.x / starWidth);
        const clampedRating = Math.max(1, Math.min(newRating, maxStars));
        handleRating(clampedRating);
      }
    })
    .onUpdate((e) => {
      if (containerWidthStr.value > 0) {
        const starWidth = containerWidthStr.value / maxStars;
        const newRating = Math.ceil(e.x / starWidth);
        const clampedRating = Math.max(1, Math.min(newRating, maxStars));
        handleRating(clampedRating);
      }
    });

  return (
    <GestureDetector gesture={panGesture}>
      <View
        ref={containerRef}
        style={styles.container}
        onLayout={(e) => {
          containerWidthStr.value = e.nativeEvent.layout.width;
        }}
      >
        {Array.from({ length: maxStars }).map((_, index) => (
          <StarItem
            key={index}
            index={index}
            rating={rating}
            size={size}
            onSelect={handleRating}
          />
        ))}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  starContainer: {
    padding: 4,
  },
});
