import { XIcon } from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import React, { forwardRef } from "react";
import {
  Pressable,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";

export interface InputTextProps extends Omit<TextInputProps, "style"> {
  value: string;
  onChangeText: (text: string) => void;
  /** Label displayed above the input */
  label?: string;
  onClear?: () => void;
  placeholder?: string;
  leftIcon?: React.ComponentType<{
    width: number;
    height: number;
    color: string;
  }>;
  /** Custom color for left icon (defaults to theme textSecondary) */
  leftIconColor?: string;
  rightIcon?: React.ComponentType<{
    width: number;
    height: number;
    color: string;
  }>;
  /** Custom color for right icon (defaults to theme textSecondary) */
  rightIconColor?: string;
  /** Callback when left icon is pressed */
  onLeftIconPress?: () => void;
  /** Callback when right icon is pressed */
  onRightIconPress?: () => void;
  showClearButton?: boolean;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  /** If true, displays a character counter (maxLength must be set) */
  showCharacterCounter?: boolean;
}

export const InputText = forwardRef<TextInput, InputTextProps>(
  (
    {
      value,
      onChangeText,
      label,
      onClear,
      placeholder = "Buscar...",
      leftIcon: LeftIcon,
      leftIconColor,
      rightIcon: RightIcon,
      rightIconColor,
      onLeftIconPress,
      onRightIconPress,
      showClearButton = false,
      containerStyle,
      inputStyle,
      multiline,
      editable = true,
      maxLength,
      showCharacterCounter,
      ...textInputProps
    },
    ref,
  ) => {
    const colors = useThemeColors();

    const handleClear = () => {
      if (onClear) {
        onClear();
      } else {
        onChangeText("");
      }
    };

    // Determine border radius based on multiline or prop override
    const borderRadius = multiline ? spacing.md : 999;
    const verticalPadding = multiline ? spacing.md : 10;

    return (
      <View style={[{ flex: 1 }, containerStyle]}>
        {label && (
          <ThemedText
            style={[
              typography.body,
              {
                color: colors.textSecondary,
                marginBottom: spacing.xs,
              },
            ]}
          >
            {label}
          </ThemedText>
        )}

        <View style={{ position: "relative" }}>
          {LeftIcon && (
            <Pressable
              onPress={onLeftIconPress}
              disabled={!onLeftIconPress}
              style={{
                position: "absolute",
                left: 12,
                top: 12,
                zIndex: 1,
              }}
            >
              <LeftIcon
                width={18}
                height={18}
                color={leftIconColor ?? colors.textSecondary}
              />
            </Pressable>
          )}

          <TextInput
            ref={ref}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colors.textSecondary}
            multiline={multiline}
            maxLength={maxLength}
            textAlignVertical={multiline ? "top" : "center"}
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius,
              paddingVertical: verticalPadding,
              paddingLeft: LeftIcon ? 36 : 16,
              paddingRight: (showClearButton && value) || RightIcon ? 36 : 16,
              color: colors.text,
              minHeight: multiline ? 120 : undefined,
              includeFontPadding: false, // Fix Android vertical alignment
              ...typography.body,
              ...inputStyle,
            }}
            {...textInputProps}
          />

          {showClearButton && value && !RightIcon && !multiline ? (
            <Pressable
              onPress={handleClear}
              style={{ position: "absolute", right: 10, top: 10, zIndex: 1 }}
            >
              <ThemedView
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <XIcon width={14} height={14} color={colors.textSecondary} />
              </ThemedView>
            </Pressable>
          ) : RightIcon ? (
            <Pressable
              onPress={onRightIconPress}
              disabled={!onRightIconPress}
              style={{
                position: "absolute",
                right: 12,
                top: 12,
                zIndex: 1,
              }}
            >
              <RightIcon width={18} height={18} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        {showCharacterCounter && maxLength && (
          <ThemedText
            style={[
              typography.caption,
              {
                color: colors.textSecondary,
                alignSelf: "flex-end",
                marginTop: spacing.xs,
              },
            ]}
          >
            {value.length}/{maxLength}
          </ThemedText>
        )}
      </View>
    );
  },
);

InputText.displayName = "InputText";
