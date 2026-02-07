import {
  CompassIcon,
  InfoRoundedIcon,
  LockOpenIcon,
  MapPinIcon,
  SparklesIcon,
} from "@/assets/icons";
import { BaseTemplateScreen } from "@/components/base-template-screen";
import { useCustomBottomSheet } from "@/components/BottomSheetProvider/hooks";
import DiscoverEmptyState from "@/components/discover/discover-empty-state";
import DiscoverSection from "@/components/discover/discover-section";
import { GenericConfirmationBottomSheet } from "@/components/generic-confirmation-bottom-sheet";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useGetDiscoverFeedQuery } from "@/modules/discover/discoverApi";
import { t } from "@/modules/locales";
import React, { ComponentType, useCallback, useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface StepConfig {
  icon: ComponentType<{ width: number; height: number; color: string }>;
  titleKey: string;
  descKey: string;
  step: number;
}

const STEPS: StepConfig[] = [
  {
    icon: MapPinIcon,
    titleKey: "screens.discover.infoStep1Title",
    descKey: "screens.discover.infoStep1Desc",
    step: 1,
  },
  {
    icon: SparklesIcon,
    titleKey: "screens.discover.infoStep2Title",
    descKey: "screens.discover.infoStep2Desc",
    step: 2,
  },
  {
    icon: LockOpenIcon,
    titleKey: "screens.discover.infoStep3Title",
    descKey: "screens.discover.infoStep3Desc",
    step: 3,
  },
];

function InfoSteps() {
  const colors = useThemeColors();

  return (
    <View style={infoStyles.stepsContainer}>
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        const isLast = index === STEPS.length - 1;

        return (
          <View key={step.titleKey} style={infoStyles.stepRow}>
            {/* Left column: icon + connector line */}
            <View style={infoStyles.stepLeftCol}>
              <View
                style={[
                  infoStyles.stepIconCircle,
                  { backgroundColor: `${colors.accent}15` },
                ]}
              >
                <Icon width={20} height={20} color={colors.accent} />
              </View>
              {!isLast && (
                <View
                  style={[
                    infoStyles.stepConnector,
                    { backgroundColor: `${colors.border}80` },
                  ]}
                />
              )}
            </View>

            {/* Right column: text */}
            <View
              style={[
                infoStyles.stepContent,
                !isLast && { paddingBottom: spacing.lg },
              ]}
            >
              <Text style={[typography.subheading, { color: colors.text }]}>
                {t(step.titleKey)}
              </Text>
              <Text
                style={[
                  typography.caption,
                  { color: colors.textSecondary, marginTop: 2 },
                ]}
              >
                {t(step.descKey)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const infoStyles = StyleSheet.create({
  stepsContainer: {
    width: "100%",
    alignItems: "flex-start",
    paddingTop: spacing.lg,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  stepLeftCol: {
    alignItems: "center",
    width: 40,
    marginRight: spacing.md,
  },
  stepIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  stepConnector: {
    width: 2,
    flex: 1,
    minHeight: 16,
    borderRadius: 1,
  },
  stepContent: {
    flex: 1,
    paddingTop: 2,
  },
});

export default function DiscoverScreen() {
  const colors = useThemeColors();
  const [refreshing, setRefreshing] = useState(false);
  const bottomSheet = useCustomBottomSheet();

  const { data, isLoading, refetch } = useGetDiscoverFeedQuery();

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const handleOpenInfo = useCallback(() => {
    bottomSheet?.expand({
      content: () => (
        <GenericConfirmationBottomSheet
          icon={CompassIcon}
          title={t("screens.discover.infoTitle")}
          description={<InfoSteps />}
          primaryButton={{
            text: t("common.done"),
            onClick: () => bottomSheet.close(),
          }}
          onClose={() => bottomSheet.close()}
        />
      ),
    });
  }, [bottomSheet]);

  const hasRecentPresence = data?.has_recent_presence ?? false;
  const feed = data?.feed;

  const hasEncounters =
    feed &&
    (feed.direct_overlap.length > 0 ||
      feed.vibe_match.length > 0 ||
      feed.path_match.length > 0);

  return (
    <BaseTemplateScreen
      ignoreBottomSafeArea
      refreshing={refreshing}
      onRefresh={handleRefresh}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={[typography.heading, { color: colors.text }]}>
              {t("screens.discover.title")}
            </Text>
            <Text
              style={[
                typography.body,
                { color: colors.textSecondary, marginTop: spacing.xs },
              ]}
            >
              {t("screens.discover.subtitle")}
            </Text>
          </View>
          <Pressable
            onPress={handleOpenInfo}
            hitSlop={12}
            style={[
              styles.infoButton,
              { backgroundColor: `${colors.textSecondary}15` },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("screens.discover.infoTitle")}
          >
            <InfoRoundedIcon
              width={20}
              height={20}
              color={colors.textSecondary}
            />
          </Pressable>
        </View>
      </View>

      {/* Loading skeleton */}
      {isLoading && (
        <View>
          {/* Skeleton section 1 */}
          <View style={styles.skeletonSection}>
            <View
              style={[
                styles.skeletonTitle,
                { backgroundColor: `${colors.textSecondary}15` },
              ]}
            />
            <View
              style={[
                styles.skeletonSubtitle,
                { backgroundColor: `${colors.textSecondary}10` },
              ]}
            />
            <View style={styles.skeletonCards}>
              {[1, 2].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.skeletonCardLarge,
                    { backgroundColor: `${colors.textSecondary}12` },
                  ]}
                />
              ))}
            </View>
          </View>

          {/* Skeleton section 2 */}
          <View style={styles.skeletonSection}>
            <View
              style={[
                styles.skeletonTitle,
                { backgroundColor: `${colors.textSecondary}15` },
              ]}
            />
            <View
              style={[
                styles.skeletonSubtitle,
                { backgroundColor: `${colors.textSecondary}10` },
              ]}
            />
            <View style={styles.skeletonCards}>
              {[1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.skeletonCardMedium,
                    { backgroundColor: `${colors.textSecondary}12` },
                  ]}
                />
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Gate: no recent presence → empty state */}
      {!isLoading && !hasRecentPresence && <DiscoverEmptyState />}

      {/* Feed sections */}
      {hasRecentPresence && hasEncounters && feed && (
        <>
          {/* Section 1: Cruzaram seu caminho */}
          {feed.direct_overlap.length > 0 && (
            <DiscoverSection
              title={t("screens.discover.sectionOverlap")}
              subtitle={t("screens.discover.sectionOverlapDesc")}
              encounters={feed.direct_overlap}
              variant="large"
            />
          )}

          {/* Section 2: Mesma Sintonia */}
          {feed.vibe_match.length > 0 && (
            <DiscoverSection
              title={t("screens.discover.sectionVibe")}
              subtitle={t("screens.discover.sectionVibeDesc")}
              encounters={feed.vibe_match}
              variant="medium"
            />
          )}

          {/* Section 3: Mesma Rotina */}
          {feed.path_match.length > 0 && (
            <DiscoverSection
              title={t("screens.discover.sectionRoutine")}
              subtitle={t("screens.discover.sectionRoutineDesc")}
              encounters={feed.path_match}
              variant="medium"
            />
          )}
        </>
      )}

      {/* Has presence but no encounters yet */}
      {hasRecentPresence && !hasEncounters && !isLoading && (
        <View style={styles.noEncountersContainer}>
          <View
            style={[
              styles.noEncountersIcon,
              { backgroundColor: `${colors.accent}15` },
            ]}
          >
            <SparklesIcon width={32} height={32} color={colors.accent} />
          </View>
          <Text
            style={[
              typography.body,
              { color: colors.textSecondary, textAlign: "center" },
            ]}
          >
            {t("screens.discover.noEncounters")}
          </Text>
        </View>
      )}
    </BaseTemplateScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingBottom: spacing.xl,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerText: {
    flex: 1,
  },
  infoButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.sm,
    marginTop: 2,
  },
  noEncountersContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: spacing.xl,
  },
  noEncountersIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  skeletonSection: {
    marginBottom: spacing.xl,
  },
  skeletonTitle: {
    width: 160,
    height: 18,
    borderRadius: 8,
    marginBottom: spacing.xs,
  },
  skeletonSubtitle: {
    width: 220,
    height: 14,
    borderRadius: 6,
    marginBottom: spacing.md,
  },
  skeletonCards: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  skeletonCardLarge: {
    width: SCREEN_WIDTH * 0.72,
    height: SCREEN_WIDTH * 0.72 * (4 / 3),
    borderRadius: 20,
  },
  skeletonCardMedium: {
    width: SCREEN_WIDTH * 0.52,
    height: SCREEN_WIDTH * 0.52 * (4 / 3),
    borderRadius: 20,
  },
});
