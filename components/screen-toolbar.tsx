import { typography } from "@/constants/theme";
import { BlurView } from "expo-blur";
import { ComponentType } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  SharedValue,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { SvgProps } from "react-native-svg";

export interface ToolbarAction {
  icon: ComponentType<SvgProps>; // SVG Icon component
  onClick: () => void;
  ariaLabel: string;
  color?: string; // Optional color override
}

export type ViewMode = "list" | "map";

interface ScreenToolbarProps {
  // Basic toolbar props
  leftAction?: ToolbarAction;
  title?: string;
  titleIcon?: ComponentType<SvgProps>; // SVG Icon component
  titleIconColor?: string;
  rightActions?: ToolbarAction | ToolbarAction[]; // Single action or array
  scrollY?: SharedValue<number>;
  customTitleView?: React.ReactNode; // Custom title (ex: connected state)
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

export function ScreenToolbar({
  leftAction,
  title,
  titleIcon,
  titleIconColor = "#1D9BF0",
  rightActions,
  scrollY,
  customTitleView,
}: ScreenToolbarProps) {
  const animatedBlurStyle = useAnimatedStyle(() => {
    if (!scrollY) return { opacity: 0 };

    const opacity = interpolate(scrollY.value, [0, 50], [0, 1], "clamp");

    return {
      opacity,
    };
  });

  const animatedBackgroundStyle = useAnimatedStyle(() => {
    if (!scrollY) return {};

    const backgroundColor = interpolate(
      scrollY.value,
      [0, 50],
      [0, 0.4],
      "clamp"
    );

    return {
      backgroundColor: `rgba(0, 0, 0, ${backgroundColor})`,
    };
  });

  const renderRightActions = () => {
    if (!rightActions) return null;

    const actions = Array.isArray(rightActions) ? rightActions : [rightActions];

    return (
      <>
        {actions.map((action, index) => (
          <ActionButton
            key={`right-action-${index}`}
            icon={action.icon}
            onPress={action.onClick}
            ariaLabel={action.ariaLabel}
            color={action.color}
          />
        ))}
      </>
    );
  };

  return (
    <View style={styles.container}>
      {/* Animated background overlay */}
      <Animated.View
        style={[StyleSheet.absoluteFill, animatedBackgroundStyle]}
      />

      {/* Animated blur layer */}
      <AnimatedBlurView
        intensity={80}
        tint="systemMaterialDark"
        experimentalBlurMethod={
          Platform.OS === "android" ? "dimezisBlurView" : undefined
        }
        style={[StyleSheet.absoluteFill, { opacity: 1 }]}
      />

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.row}>
          {/* Left Action */}
          {leftAction ? (
            <ActionButton
              icon={leftAction.icon}
              onPress={leftAction.onClick}
              ariaLabel={leftAction.ariaLabel}
              color={leftAction.color}
            />
          ) : (
            // If no left icon, show title left-aligned
            <View
              style={[
                styles.titleContainer,
                { flex: 1, justifyContent: "flex-start" },
              ]}
            >
              {customTitleView ? (
                customTitleView
              ) : (
                <>
                  {titleIcon &&
                    (() => {
                      const TitleIcon = titleIcon;
                      return (
                        <TitleIcon
                          width={20}
                          height={20}
                          color={titleIconColor}
                        />
                      );
                    })()}
                  <Text style={styles.title}>{title}</Text>
                </>
              )}
            </View>
          )}

          {/* Title (centered only if leftAction exists) */}
          {leftAction && (
            <View style={styles.titleContainer}>
              {customTitleView ? (
                customTitleView
              ) : (
                <>
                  {titleIcon &&
                    (() => {
                      const TitleIcon = titleIcon;
                      return (
                        <TitleIcon
                          width={20}
                          height={20}
                          color={titleIconColor}
                        />
                      );
                    })()}
                  <Text style={styles.title}>{title}</Text>
                </>
              )}
            </View>
          )}

          {/* Right Actions */}
          <View style={styles.rightActions}>{renderRightActions()}</View>
        </View>
      </View>
    </View>
  );
}

function ActionButton({
  icon: IconComponent,
  onPress,
  ariaLabel,
  color = "#FFF",
}: {
  icon: ComponentType<SvgProps>;
  onPress: () => void;
  ariaLabel: string;
  color?: string;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.actionButton, animatedStyle]}
      accessibilityLabel={ariaLabel}
    >
      <IconComponent width={24} height={24} color={color} stroke={color} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(47, 51, 54, 0.5)",
  },
  content: {
    padding: 16,
    paddingTop: 64, // Account for status bar (48px) + extra spacing
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#16181C",
    borderWidth: 1,
    borderColor: "#2F3336",
    alignItems: "center",
    justifyContent: "center",
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    ...typography.body,
    color: "#E7E9EA",
    // fontSize: 18,
  },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  compactToggleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  compactToggleButtonActive: {
    backgroundColor: "#1D9BF0",
  },
  compactToggleButtonInactive: {
    backgroundColor: "#16181C",
    borderWidth: 1,
    borderColor: "#2F3336",
  },
  defaultToggleButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  defaultToggleButtonActive: {
    backgroundColor: "#1D9BF0",
  },
  defaultToggleButtonInactive: {
    backgroundColor: "#16181C",
    borderWidth: 1,
    borderColor: "#2F3336",
  },
  defaultToggleButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  defaultToggleButtonTextActive: {
    color: "#fff",
  },
  defaultToggleButtonTextInactive: {
    color: "#8B98A5",
  },
});
