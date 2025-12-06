import { ChevronDownIcon, ChevronUpIcon, XIcon } from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

interface MultiSelectSheetProps<T> {
  selectedItems: T[];
  getItemId: (item: T) => string;
  getItemLabel: (item: T) => string;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onRemoveItem: (item: T) => void;
  style?: ViewStyle;
  maxHeight?: number;
}

export function MultiSelectSheet<T>({
  selectedItems,
  getItemId,
  getItemLabel,
  isExpanded,
  onToggleExpanded,
  onRemoveItem,
  style,
  maxHeight = 320,
}: MultiSelectSheetProps<T>) {
  const colors = useThemeColors();
  const heightAnim = useSharedValue(80);

  React.useEffect(() => {
    heightAnim.value = withTiming(isExpanded ? maxHeight : 80, {
      duration: 200,
    });
  }, [isExpanded, heightAnim, maxHeight]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: heightAnim.value,
  }));

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          borderColor: colors.surface,
        },
        animatedStyle,
        style,
      ]}
    >
      {/* Header - Always Visible */}
      <Pressable
        onPress={onToggleExpanded}
        style={({ pressed }) => [
          styles.header,
          pressed && styles.headerPressed,
        ]}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerText}>
            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>
              Selecionados
            </ThemedText>
            <ThemedText style={styles.count}>
              {selectedItems.length}{" "}
              {selectedItems.length === 1 ? "spot" : "spots"}
            </ThemedText>
          </View>
        </View>

        {isExpanded ? (
          <ChevronDownIcon width={20} height={20} color={colors.accent} />
        ) : (
          <ChevronUpIcon width={20} height={20} color={colors.accent} />
        )}
      </Pressable>

      {/* Expanded List */}
      {isExpanded && (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {selectedItems.map((item) => (
            <Pressable
              key={getItemId(item)}
              onPress={() => onRemoveItem(item)}
              style={({ pressed }) => [
                styles.listItem,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && styles.listItemPressed,
              ]}
            >
              <ThemedText style={styles.listItemText}>
                {getItemLabel(item)}
              </ThemedText>
              <XIcon width={16} height={16} color={colors.textSecondary} />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
  },
  header: {
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerPressed: {
    opacity: 0.8,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  checkIcon: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerText: {
    gap: 2,
  },
  label: {
    fontFamily: "Poppins",
    fontWeight: "400",
    fontSize: 13,
  },
  count: {
    fontFamily: "Poppins",
    fontWeight: "600",
    fontSize: 16,
    color: "#FFFFFF",
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  listContent: {
    gap: spacing.xs,
    paddingBottom: 48,
  },
  listItem: {
    padding: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  listItemPressed: {
    opacity: 0.7,
  },
  listItemText: {
    fontFamily: "Poppins",
    fontWeight: "500",
    fontSize: 14,
    color: "#FFFFFF",
  },
});
