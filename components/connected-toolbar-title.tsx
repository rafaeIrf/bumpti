import { MapPinIcon } from "@/assets/icons";
import { typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

interface ConnectedToolbarTitleProps {
  venueName: string;
  onPress: () => void;
}

export const ConnectedToolbarTitle: React.FC<ConnectedToolbarTitleProps> = ({
  venueName,
  onPress,
}) => {
  const colors = useThemeColors();

  // Animação sutil de brilho para o ícone
  const opacity = useSharedValue(0.6);

  React.useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 2000 }), -1, true);
  }, [opacity]);

  const iconContainerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      exiting={FadeOut.duration(300)}
    >
      <TouchableOpacity
        style={styles.container}
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityLabel={`Conectado em ${venueName}. Toque para ver detalhes`}
      >
        <Animated.View style={[styles.iconContainer, iconContainerStyle]}>
          <MapPinIcon width={20} height={20} color={colors.accent} />
        </Animated.View>
        <Text style={[styles.text, { color: colors.text }]}>{venueName}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  iconContainer: {
    shadowColor: "#2997FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  text: {
    ...typography.body,
    fontFamily: "Poppins-SemiBold",
  },
});
