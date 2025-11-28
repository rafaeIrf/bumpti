import { ArrowLeftIcon, SearchIcon } from "@/assets/icons";
import { Input } from "@/components/ui/search-input";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

interface SearchToolbarProps {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
  placeholder?: string;
  onBack?: () => void;
  autoFocus?: boolean;
}

export function SearchToolbar({
  value,
  onChangeText,
  onClear,
  placeholder,
  onBack,
  autoFocus,
}: Readonly<SearchToolbarProps>) {
  const colors = useThemeColors();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: spacing.md,
        },
      ]}
    >
      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={8}
          style={[
            styles.backButton,
            {
              borderColor: colors.border,
              backgroundColor: colors.surface,
            },
          ]}
        >
          <ArrowLeftIcon width={20} height={20} color={colors.text} />
        </Pressable>
      ) : null}
      <Input
        value={value}
        onChangeText={onChangeText}
        onClear={onClear}
        placeholder={placeholder}
        leftIcon={SearchIcon}
        autoFocus={autoFocus}
        showClearButton
        containerStyle={[
          styles.inputWrapper,
          {
            borderColor: colors.border,
            backgroundColor: colors.surface,
          },
        ]}
        inputStyle={{
          ...typography.body,
          backgroundColor: "transparent",
          borderWidth: 0,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  inputWrapper: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
  },
});
