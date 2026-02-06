import { ThemedText } from "@/components/themed-text";
import { Chip } from "@/components/ui/chip";
import {
  INTEREST_CATEGORIES,
  MAX_INTERESTS,
} from "@/constants/profile-options";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import { logger } from "@/utils/logger";
import React, { useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";

interface InterestsSelectorProps {
  selectedKeys: string[];
  onSelectedKeysChange: (keys: string[]) => void;
  /** If true, shows title + subtitle header. Defaults to true. */
  showHeader?: boolean;
  /** If true, shows the title inside the header. Defaults to true. */
  showTitle?: boolean;
}

export default function InterestsSelector({
  selectedKeys,
  onSelectedKeysChange,
  showHeader = true,
  showTitle = true,
}: InterestsSelectorProps) {
  const colors = useThemeColors();

  const isMaxReached = selectedKeys.length >= MAX_INTERESTS;

  const handleToggle = useCallback(
    (key: string) => {
      if (selectedKeys.includes(key)) {
        onSelectedKeysChange(selectedKeys.filter((k) => k !== key));
      } else {
        if (selectedKeys.length >= MAX_INTERESTS) {
          logger.warn("Max interests reached:", MAX_INTERESTS);
          return;
        }
        onSelectedKeysChange([...selectedKeys, key]);
      }
    },
    [selectedKeys, onSelectedKeysChange],
  );

  const groupedInterests = useMemo(() => {
    return INTEREST_CATEGORIES.map((category) => ({
      categoryKey: category.key,
      label: t(
        `screens.onboarding.interests.categories.${category.key}` as any,
      ),
      items: category.items,
    }));
  }, []);

  return (
    <>
      {showHeader && (
        <View style={styles.header}>
          {showTitle && (
            <ThemedText style={[typography.heading, { color: colors.text }]}>
              {t("screens.onboarding.interests.title")}
            </ThemedText>
          )}
          <ThemedText
            style={[
              typography.body,
              {
                color: colors.textSecondary,
                marginTop: showTitle ? spacing.xs : 0,
              },
            ]}
          >
            {t("screens.onboarding.interests.subtitle")}
          </ThemedText>
        </View>
      )}

      {groupedInterests.map((group) => (
        <View key={group.categoryKey} style={styles.categoryGroup}>
          <ThemedText
            style={[
              typography.caption,
              {
                color: colors.textSecondary,
                marginBottom: spacing.sm,
                textTransform: "uppercase",
                letterSpacing: 1,
              },
            ]}
          >
            {group.label}
          </ThemedText>
          <View style={styles.pillGrid}>
            {group.items.map((interest) => {
              const isSelected = selectedKeys.includes(interest.key);
              return (
                <Chip
                  key={interest.key}
                  icon={
                    <ThemedText style={{ fontSize: 16 }}>
                      {interest.icon}
                    </ThemedText>
                  }
                  label={t(
                    `screens.onboarding.interests.items.${interest.key}` as any,
                  )}
                  selected={isSelected}
                  disabled={isMaxReached && !isSelected}
                  onPress={() => handleToggle(interest.key)}
                />
              );
            })}
          </View>
        </View>
      ))}
      <View style={{ height: 120 }} />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  categoryGroup: {
    marginBottom: spacing.lg,
  },
  pillGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
});
