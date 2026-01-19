import {
  CompassIcon,
  FlameIcon,
  HeartIcon,
  SearchIcon,
  StarIcon,
} from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import Button from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import React from "react";
import { StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

export type PlacesEmptyMode =
  | "favorites"
  | "trending"
  | "nearby"
  | "communityFavorites"
  | "ranking"
  | "search"
  | "default";

interface PlacesEmptyStateProps {
  mode: PlacesEmptyMode;
  onPress: () => void;
}

export function PlacesEmptyState({ mode, onPress }: PlacesEmptyStateProps) {
  const colors = useThemeColors();

  const getIcon = () => {
    const iconProps = { width: 48, height: 48, color: colors.textSecondary };
    switch (mode) {
      case "favorites":
        return <HeartIcon {...iconProps} fill="none" />;
      case "trending":
        return <FlameIcon {...iconProps} />;
      case "nearby":
        return <CompassIcon {...iconProps} />;
      case "communityFavorites":
        return <StarIcon {...iconProps} fill="none" />;
      case "ranking":
        return <FlameIcon {...iconProps} />;
      case "search":
        return <SearchIcon {...iconProps} />;
      case "default":
      default:
        return <CompassIcon {...iconProps} />;
    }
  };

  const titleKey = `screens.categoryResults.emptyStates.${mode}.title`;
  const descriptionKey = `screens.categoryResults.emptyStates.${mode}.description`;
  const buttonKey = `screens.categoryResults.emptyStates.${mode}.button`;

  return (
    <Animated.View entering={FadeInDown.delay(0).springify()}>
      <ThemedView style={styles.emptyContainer}>
        <ThemedView
          style={[
            styles.emptyIcon,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          {getIcon()}
        </ThemedView>
        <ThemedText
          style={[
            styles.emptyTitle,
            { ...typography.subheading, color: colors.text },
          ]}
        >
          {t(titleKey)}
        </ThemedText>
        <ThemedText
          style={[
            styles.emptyDescription,
            { ...typography.body, color: colors.textSecondary },
          ]}
        >
          {t(descriptionKey)}
        </ThemedText>
        <Button
          onPress={onPress}
          variant="default"
          size="lg"
          label={t(buttonKey)}
          style={styles.emptyButton}
        />
      </ThemedView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
    minHeight: 400,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  emptyDescription: {
    textAlign: "center",
    maxWidth: 320,
    marginBottom: spacing.lg,
  },
  emptyButton: {
    paddingHorizontal: spacing.xl,
  },
});
