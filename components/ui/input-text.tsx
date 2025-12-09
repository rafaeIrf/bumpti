import { XIcon } from "@/assets/icons";
import { ThemedView } from "@/components/themed-view";
import { typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import React, { forwardRef } from "react";
import {
  Pressable,
  TextInput,
  TextInputProps,
  TextStyle,
  ViewStyle,
} from "react-native";

export interface InputTextProps extends Omit<TextInputProps, "style"> {
  value: string;
  onChangeText: (text: string) => void;
  onClear?: () => void;
  placeholder?: string;
  leftIcon?: React.ComponentType<{
    width: number;
    height: number;
    color: string;
  }>;
  rightIcon?: React.ComponentType<{
    width: number;
    height: number;
    color: string;
  }>;
  showClearButton?: boolean;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
}

export const InputText = forwardRef<TextInput, InputTextProps>(
  (
    {
      value,
      onChangeText,
      onClear,
      placeholder = "Buscar...",
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      showClearButton = true,
      containerStyle,
      inputStyle,
      ...textInputProps
    },
    ref
  ) => {
    const colors = useThemeColors();

    const handleClear = () => {
      if (onClear) {
        onClear();
      } else {
        onChangeText("");
      }
    };

    return (
      <ThemedView style={[{ flex: 1, position: "relative" }, containerStyle]}>
        {LeftIcon && (
          <ThemedView
            style={{
              position: "absolute",
              left: 12,
              top: 12,
              zIndex: 1,
              backgroundColor: "transparent",
            }}
          >
            <LeftIcon width={18} height={18} color={colors.textSecondary} />
          </ThemedView>
        )}
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 999,
            paddingVertical: 10,
            paddingLeft: LeftIcon ? 36 : 16,
            paddingRight: (showClearButton && value) || RightIcon ? 36 : 16,
            color: colors.text,
            textAlignVertical: "center",
            ...typography.body,
            ...inputStyle,
          }}
          {...textInputProps}
        />
        {showClearButton && value && !RightIcon ? (
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
          <ThemedView
            style={{
              position: "absolute",
              right: 12,
              top: 12,
              zIndex: 1,
              backgroundColor: "transparent",
            }}
          >
            <RightIcon width={18} height={18} color={colors.textSecondary} />
          </ThemedView>
        ) : null}
      </ThemedView>
    );
  }
);

InputText.displayName = "InputText";
