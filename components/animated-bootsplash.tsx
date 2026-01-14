import { useState } from "react";
import { Image, StyleSheet } from "react-native";
import RNBootSplash from "react-native-bootsplash";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming
} from "react-native-reanimated";

type Props = {
  ready?: boolean; // When true, starts the hide animation
  onAnimationEnd: () => void;
};

/**
 * Animated BootSplash Component
 * 
 * Uses useHideAnimation hook to create a custom hide animation
 * with a subtle pulse/breathing effect on the logo before hiding.
 * 
 * Following react-native-bootsplash best practices:
 * https://github.com/zoontek/react-native-bootsplash
 */
export function AnimatedBootSplash({ ready = true, onAnimationEnd }: Props) {
  const [visible, setVisible] = useState(true);
  
  // Opacity animation: subtle pulse from 0.85 to 1.0
  const opacity = useSharedValue(1);
  // Scale animation: very subtle pulse from 1.0 to 1.02
  const scale = useSharedValue(1.0);

  // Helper function to handle animation end (must be wrapped for runOnJS)
  const handleAnimationComplete = () => {
    setVisible(false);
    onAnimationEnd();
  };

  // Get splash screen elements from useHideAnimation hook
  // The animate callback is called when ready becomes true
  const { container, logo } = RNBootSplash.useHideAnimation({
    manifest: require("../assets/bootsplash/manifest.json"),
    logo: require("../assets/bootsplash/logo.png"),
    ready, // Pass ready prop - animate is called when this becomes true
    
    // Specify if using translucent status/navigation bars
    statusBarTranslucent: false,
    navigationBarTranslucent: false,

    // Animation function - called when ready becomes true
    // This runs in a worklet context
    animate: () => {
      "worklet";
      
      // Simple approach: pulse for a short time, then fade out
      // Use withSequence to chain: pulse animation -> delay -> fade out
      
      // Opacity: pulse then fade
      opacity.value = withSequence(
        // Pulse: one cycle (down to 0.85 and back to 1.0)
        withTiming(0.85, {
          duration: 750, // Half cycle down
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(1.0, {
          duration: 750, // Half cycle back up
          easing: Easing.inOut(Easing.ease),
        }),
        // Wait a moment, then fade out smoothly
        withDelay(300, withTiming(0, {
          duration: 700, // Longer duration for smoother fade
          easing: Easing.out(Easing.cubic), // Smoother easing curve
        }))
      );

      // Scale: pulse then fade
      scale.value = withSequence(
        // Pulse: one cycle (up to 1.02 and back to 1.0)
        withTiming(1.02, {
          duration: 1000, // Half cycle up
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(1.0, {
          duration: 1000, // Half cycle back down
          easing: Easing.inOut(Easing.ease),
        }),
        // Wait a moment, then scale down and fade smoothly
        withDelay(300, withTiming(0.95, {
          duration: 700, // Match opacity duration for synchronized fade
          easing: Easing.out(Easing.cubic), // Smoother easing curve
        }, (finished) => {
          "worklet";
          if (finished) {
            // Call JS function from worklet
            runOnJS(handleAnimationComplete)();
          }
        }))
      );
    },
  });

  // Animated style for logo pulse effect
  const animatedLogoStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!visible) {
    return null;
  }

  return (
    <Animated.View {...container} style={[styles.container, container.style, animatedLogoStyle]}>
      <Image {...logo} style={[styles.logo, logo.style]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000000", // Ensure black background matches native splash
  },
  logo: {
    // Logo styles are provided by useHideAnimation hook
  },
});
