import { CheckIcon, XIcon } from "@/assets/icons";
import { useThemeColors } from "@/hooks/use-theme-colors";
import React from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

interface SwipeActionButtonsProps {
  onLike: () => void;
  onSkip: () => void;
  swipeX?: SharedValue<number> | null; // Shared value from parent swiper
}

export const SwipeActionButtons: React.FC<SwipeActionButtonsProps> = ({
  onLike,
  onSkip,
  swipeX,
}) => {
  const colors = useThemeColors();

  // Animations based on swipe direction
  const dislikeButtonStyle = useAnimatedStyle(() => {
    "worklet";
    if (!swipeX) {
      return {
        transform: [{ scale: 1 }],
        shadowColor: "#8B98A5",
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
      };
    }

    // When swiping left (dislike), scale up button and add glow
    const leftSwipe = Math.max(0, -swipeX.value);
    const scaleButton = interpolate(
      leftSwipe,
      [0, 100],
      [1, 1.12],
      Extrapolation.CLAMP
    );
    const glowOpacity = interpolate(
      leftSwipe,
      [0, 100],
      [0, 0.5],
      Extrapolation.CLAMP
    );
    const glowRadius = interpolate(
      leftSwipe,
      [0, 100],
      [0, 20],
      Extrapolation.CLAMP
    );

    // When swiping right (like), scale down
    const rightSwipe = Math.max(0, swipeX.value);
    const scaleDown = interpolate(
      rightSwipe,
      [0, 100],
      [1, 0.88],
      Extrapolation.CLAMP
    );

    const finalScale =
      rightSwipe > 10 ? scaleDown : leftSwipe > 10 ? scaleButton : 1;

    return {
      transform: [
        {
          scale: withSpring(finalScale, {
            damping: 15,
            stiffness: 150,
            mass: 0.5,
          }),
        },
      ],
      shadowColor: "#8B98A5",
      shadowOpacity: leftSwipe > 10 ? glowOpacity : 0,
      shadowRadius: leftSwipe > 10 ? glowRadius : 0,
      shadowOffset: { width: 0, height: 0 },
      elevation: leftSwipe > 10 ? 12 : 8,
    };
  });

  const likeButtonStyle = useAnimatedStyle(() => {
    "worklet";
    if (!swipeX) {
      return {
        transform: [{ scale: 1 }],
        shadowColor: "#2997FF",
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
      };
    }

    // When swiping right (like), scale up button and add glow
    const rightSwipe = Math.max(0, swipeX.value);
    const scaleButton = interpolate(
      rightSwipe,
      [0, 100],
      [1, 1.12],
      Extrapolation.CLAMP
    );
    const glowOpacity = interpolate(
      rightSwipe,
      [0, 100],
      [0, 0.6],
      Extrapolation.CLAMP
    );
    const glowRadius = interpolate(
      rightSwipe,
      [0, 100],
      [0, 24],
      Extrapolation.CLAMP
    );

    // When swiping left (dislike), scale down
    const leftSwipe = Math.max(0, -swipeX.value);
    const scaleDown = interpolate(
      leftSwipe,
      [0, 100],
      [1, 0.88],
      Extrapolation.CLAMP
    );

    const finalScale =
      leftSwipe > 10 ? scaleDown : rightSwipe > 10 ? scaleButton : 1;

    return {
      transform: [
        {
          scale: withSpring(finalScale, {
            damping: 15,
            stiffness: 150,
            mass: 0.5,
          }),
        },
      ],
      shadowColor: "#2997FF",
      shadowOpacity: rightSwipe > 10 ? glowOpacity : 0,
      shadowRadius: rightSwipe > 10 ? glowRadius : 0,
      shadowOffset: { width: 0, height: 0 },
      elevation: rightSwipe > 10 ? 16 : 8,
    };
  });

  return (
    <>
      <Animated.View style={[styles.buttonContainer, dislikeButtonStyle]}>
        <Pressable
          onPress={onSkip}
          style={[
            styles.skipButton,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <XIcon width={32} height={32} color={colors.textSecondary} />
        </Pressable>
      </Animated.View>

      <Animated.View style={[styles.buttonContainer, likeButtonStyle]}>
        <Pressable
          onPress={onLike}
          style={[
            styles.likeButton,
            {
              backgroundColor: colors.accent,
            },
          ]}
        >
          <CheckIcon width={32} height={32} color="#FFFFFF" />
        </Pressable>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  buttonContainer: {
    // elevation removed - animated in useAnimatedStyle
  },
  skipButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  likeButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
});
