import { CheckIcon, RewindIcon, XIcon } from "@/assets/icons";
import { useThemeColors } from "@/hooks/use-theme-colors";
import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

type ActionType = "like" | "dislike" | "rewind";

interface AnimatedCircleButtonProps {
  type: ActionType;
  onPress: () => void;
  disabled?: boolean;
  sizeVariant: "small" | "large";
  backgroundColor: string;
  borderColor?: string;
  icon: React.ReactNode;
}

interface SwipeActionButtonsProps {
  onLike: () => void;
  onSkip: () => void;
  onRewind?: () => void;
  isRewindDisabled?: boolean;
  swipeX?: SharedValue<number> | null; // Shared value from parent swiper
}

const AnimatedCircleButton: React.FC<AnimatedCircleButtonProps> = ({
  type,
  onPress,
  disabled = false,
  sizeVariant,
  backgroundColor,
  borderColor,
  icon,
}) => {
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotation = useSharedValue(0);
  const timingFast = { duration: 140 };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  const triggerAnimation = () => {
    switch (type) {
      case "like":
        scale.value = withSequence(
          withTiming(1.3, timingFast),
          withTiming(1, timingFast)
        );
        translateY.value = withSequence(
          withTiming(-6, timingFast),
          withTiming(0, timingFast)
        );
        break;
      case "dislike":
        scale.value = withSequence(
          withTiming(1.3, timingFast),
          withTiming(1, timingFast)
        );
        translateX.value = withTiming(0, timingFast);
        break;
      case "rewind": {
        scale.value = withSequence(
          withTiming(1.3, timingFast),
          withTiming(1, timingFast)
        );
        rotation.value = withTiming(-360, { duration: 360 }, () => {
          rotation.value = 0;
        });
        break;
      }
      default:
        break;
    }
  };

  const handlePress = () => {
    if (disabled) return;

    if (type === "like") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (type === "dislike") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    triggerAnimation();
    onPress();
  };

  return (
    <Animated.View
      style={[
        styles.circleButton,
        sizeVariant === "small"
          ? styles.circleButtonSmall
          : styles.circleButtonLarge,
        { backgroundColor, borderColor },
        animatedStyle,
      ]}
    >
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        style={[styles.pressableContent, disabled && styles.pressableDisabled]}
      >
        {icon}
      </Pressable>
    </Animated.View>
  );
};

export const SwipeActionButtons: React.FC<SwipeActionButtonsProps> = ({
  onLike,
  onSkip,
  onRewind,
  isRewindDisabled = false,
  swipeX,
}) => {
  const colors = useThemeColors();
  const rewindBackground = isRewindDisabled ? colors.surface : colors.surface;
  const rewindIconColor = isRewindDisabled
    ? colors.textSecondary
    : colors.pastelGold;

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
      {onRewind && (
        <Animated.View style={styles.buttonContainer}>
          <AnimatedCircleButton
            type="rewind"
            onPress={onRewind}
            disabled={isRewindDisabled}
            sizeVariant="small"
            backgroundColor={rewindBackground}
            borderColor={colors.border}
            icon={<RewindIcon width={20} height={20} color={rewindIconColor} />}
          />
        </Animated.View>
      )}

      <Animated.View style={[styles.buttonContainer, dislikeButtonStyle]}>
        <AnimatedCircleButton
          type="dislike"
          onPress={onSkip}
          sizeVariant="large"
          backgroundColor={colors.surface}
          borderColor={colors.border}
          icon={<XIcon width={32} height={32} color={colors.textSecondary} />}
        />
      </Animated.View>

      <Animated.View style={[styles.buttonContainer, likeButtonStyle]}>
        <AnimatedCircleButton
          type="like"
          onPress={onLike}
          sizeVariant="large"
          backgroundColor={colors.accent}
          borderColor="transparent"
          icon={<CheckIcon width={32} height={32} color="#FFFFFF" />}
        />
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  buttonContainer: {
    // elevation removed - animated in useAnimatedStyle
  },
  circleButton: {
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  circleButtonSmall: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  circleButtonLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  pressableContent: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  pressableDisabled: {
    opacity: 0.5,
  },
});
