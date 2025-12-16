import React, { ReactElement, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  type StyleProp,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";

import { Colors, typography } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

type ButtonVariant =
  | "default"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "link";

export type ButtonSize = "default" | "sm" | "lg" | "icon" | "fab";

export interface ButtonProps extends Omit<PressableProps, "style"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Optional node rendered before the label */
  leftIcon?: ReactNode;
  /** Optional node rendered after the label */
  rightIcon?: ReactNode;
  /** Text to render when children is not provided */
  label?: string;
  /** Container style override */
  style?: StyleProp<ViewStyle>;
  /** Text style override */
  textStyle?: StyleProp<TextStyle>;
  /** Apply full width */
  fullWidth?: boolean;
  /** Show loading indicator and disable interactions */
  loading?: boolean;
}

function getVariantStyles(C: any, variant: ButtonVariant, pressed: boolean) {
  const base: { container: ViewStyle; text: TextStyle; pressed?: ViewStyle } = {
    container: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: 999,
      borderWidth: 0,
    },
    text: {
      ...typography.body,
      color: C.text,
      fontWeight: "600",
    },
    pressed: undefined,
  };

  switch (variant) {
    case "destructive":
      base.container.backgroundColor = C.error;
      base.text.color = "#FFFFFF";
      base.pressed = { opacity: 0.9 };
      break;
    case "outline":
      base.container.backgroundColor = C.background;
      base.container.borderWidth = 1;
      base.container.borderColor = C.border;
      base.text.color = C.text;
      base.pressed = { backgroundColor: (C as any).surfaceHover ?? C.surface };
      break;
    case "secondary":
      base.container.backgroundColor = C.surface;
      base.text.color = C.text;
      base.pressed = { opacity: 0.9 };
      break;
    case "ghost":
      base.container.backgroundColor = "transparent";
      base.text.color = C.text;
      base.pressed = {
        backgroundColor: (C as any).accentBlueLighter ?? "rgba(0,0,0,0.05)",
      };
      break;
    case "link":
      base.container.backgroundColor = "transparent";
      base.text.color = C.accent;
      base.pressed = { opacity: 0.7 };
      break;
    case "default":
    default:
      base.container.backgroundColor = C.accent;
      base.text.color = "#FFFFFF";
      base.pressed = { opacity: 0.9 };
      break;
  }

  // Apply a subtle pressed state if defined
  const container =
    pressed && base.pressed ? [base.container, base.pressed] : base.container;
  return { container, text: base.text };
}

function getSizeStyles(size: ButtonSize, fullWidth?: boolean) {
  const base: { container: ViewStyle; text: TextStyle } = {
    container: { paddingHorizontal: 16, minHeight: 36 },
    text: { ...typography.body1 },
  };

  switch (size) {
    case "sm":
      base.container.minHeight = 32;
      base.container.paddingHorizontal = 12;
      base.text.fontSize = typography.caption.fontSize;
      base.text.lineHeight = typography.caption.lineHeight;
      break;
    case "lg":
      base.container.minHeight = 40;
      base.container.paddingHorizontal = 20;
      base.text.fontSize = typography.body.fontSize;
      base.text.lineHeight = typography.heading.lineHeight;
      break;
    case "icon":
      base.container.minHeight = 36;
      base.container.width = 36;
      base.container.paddingHorizontal = 0;
      break;
    case "fab":
      base.container.minHeight = 56;
      base.container.width = 56;
      base.container.paddingHorizontal = 0;
      break;
    case "default":
    default:
      // keep defaults
      break;
  }

  if (fullWidth) {
    base.container.alignSelf = "stretch";
  }

  return base;
}

function getIconDimensions(size: ButtonSize) {
  switch (size) {
    case "sm":
      return { width: 16, height: 16 };
    case "lg":
      return { width: 20, height: 20 };
    case "fab":
      return { width: 24, height: 24 };
    case "icon":
      return { width: 18, height: 18 };
    case "default":
    default:
      return { width: 18, height: 18 };
  }
}

export function Button({
  variant = "default",
  size = "default",
  leftIcon,
  rightIcon,
  label,
  children,
  style,
  textStyle,
  disabled,
  fullWidth,
  loading,
  ...props
}: ButtonProps) {
  const scheme = useColorScheme() ?? "light";
  const C = (Colors as any)[scheme] as any;

  const renderIcon = (
    icon?: ReactNode,
    color?: string,
    dimensions?: { width: number; height: number }
  ) => {
    if (!icon) return null;
    if (typeof icon === "function") {
      const IconComponent = icon as React.ComponentType<any>;
      return (
        <View style={styles.icon}>
          <IconComponent
            color={color}
            width={dimensions?.width}
            height={dimensions?.height}
          />
        </View>
      );
    }
    if (React.isValidElement(icon)) {
      const iconElement = icon as ReactElement<any>;
      const injectedColor =
        iconElement.props?.color !== undefined
          ? iconElement.props.color
          : color;
      const iconWidth =
        iconElement.props?.width !== undefined
          ? iconElement.props.width
          : dimensions?.width;
      const iconHeight =
        iconElement.props?.height !== undefined
          ? iconElement.props.height
          : dimensions?.height;
      return (
        <View style={styles.icon}>
          {React.cloneElement(iconElement, {
            color: injectedColor,
            width: iconWidth,
            height: iconHeight,
          })}
        </View>
      );
    }
    return <View style={styles.icon}>{icon}</View>;
  };

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={({ pressed }) => {
        const v = getVariantStyles(C, variant, pressed);
        const s = getSizeStyles(size, fullWidth);
        return [
          styles.base,
          v.container,
          s.container,
          disabled && styles.disabled,
          style,
        ];
      }}
      {...props}
    >
      {({ pressed }) => {
        const v = getVariantStyles(C, variant, pressed);
        const s = getSizeStyles(size, fullWidth);
        const content = typeof children === "string" ? children : label;
        const iconDimensions = getIconDimensions(size);
        return (
          <View style={styles.contentRow}>
            {loading ? (
              <View style={styles.icon}>
                <ActivityIndicator
                  size="small"
                  color={(v.text.color as string) ?? undefined}
                />
              </View>
            ) : (
              renderIcon(leftIcon, v.text.color as string, iconDimensions)
            )}
            {content ? (
              <Text numberOfLines={1} style={[v.text, s.text, textStyle]}>
                {content}
              </Text>
            ) : (
              // If no label and not string children, render children as-is
              (children as ReactNode)
            )}
            {renderIcon(rightIcon, v.text.color as string, iconDimensions)}
          </View>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 999,
    overflow: "hidden",
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
  },
  icon: {
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.5,
  },
});

export default Button;
