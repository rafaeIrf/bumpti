import {
  CalendarIcon,
  CheckIcon,
  GlobeIcon,
  HeartIcon,
  MapPinIcon,
  SearchIcon,
  SparklesIcon,
  UsersIcon,
} from "@/assets/icons";
import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { t } from "@/modules/locales";
import React from "react";
import { StyleSheet, View } from "react-native";

interface Benefit {
  icon: any;
  titleKey: string;
  subtitleKey: string;
}

const BENEFITS: Benefit[] = [
  {
    icon: HeartIcon,
    titleKey: "screens.premiumPaywall.benefits.unlimitedLikes.title",
    subtitleKey: "screens.premiumPaywall.benefits.unlimitedLikes.subtitle",
  },
  {
    icon: SearchIcon,
    titleKey: "screens.premiumPaywall.benefits.seeWhoLiked.title",
    subtitleKey: "screens.premiumPaywall.benefits.seeWhoLiked.subtitle",
  },
  {
    icon: SparklesIcon,
    titleKey: "screens.premiumPaywall.benefits.priorityLikes.title",
    subtitleKey: "screens.premiumPaywall.benefits.priorityLikes.subtitle",
  },
  {
    icon: CheckIcon,
    titleKey: "screens.premiumPaywall.benefits.unlimitedRewind.title",
    subtitleKey: "screens.premiumPaywall.benefits.unlimitedRewind.subtitle",
  },
  {
    icon: UsersIcon,
    titleKey: "screens.premiumPaywall.benefits.visibilityControl.title",
    subtitleKey: "screens.premiumPaywall.benefits.visibilityControl.subtitle",
  },
  // {
  //   icon: SearchIcon,
  //   titleKey: "screens.premiumPaywall.benefits.seeWhoViewed.title",
  //   subtitleKey: "screens.premiumPaywall.benefits.seeWhoViewed.subtitle",
  // },
  // {
  //   icon: FlameIcon,
  //   titleKey: "screens.premiumPaywall.benefits.turboIncluded.title",
  //   subtitleKey: "screens.premiumPaywall.benefits.turboIncluded.subtitle",
  // },
  {
    icon: CalendarIcon,
    titleKey: "screens.premiumPaywall.benefits.morePlans.title",
    subtitleKey: "screens.premiumPaywall.benefits.morePlans.subtitle",
  },
  {
    icon: MapPinIcon,
    titleKey: "screens.premiumPaywall.benefits.earlyCheckin.title",
    subtitleKey: "screens.premiumPaywall.benefits.earlyCheckin.subtitle",
  },
  {
    icon: GlobeIcon,
    titleKey: "screens.premiumPaywall.benefits.exploreCities.title",
    subtitleKey: "screens.premiumPaywall.benefits.exploreCities.subtitle",
  },
  // {
  //   icon: NavigationIcon,
  //   titleKey: "screens.premiumPaywall.benefits.pings.title",
  //   subtitleKey: "screens.premiumPaywall.benefits.pings.subtitle",
  // },
];

interface PremiumBenefitsProps {
  planId?: string | null;
  showSubscriptionBonus?: boolean;
}

export function PremiumBenefits({
  planId,
  showSubscriptionBonus,
}: PremiumBenefitsProps) {
  const colors = useThemeColors();

  return (
    <View style={styles.benefitsSection}>
      {BENEFITS.map((benefit) => {
        // Special logic for Early Check-in Benefit
        if (
          benefit.titleKey ===
          "screens.premiumPaywall.benefits.earlyCheckin.title"
        ) {
          // If explicitly disabled via showSubscriptionBonus=false, don't show it
          if (showSubscriptionBonus === false) {
            return null;
          }

          // If showSubscriptionBonus is true AND we have a planId, customize the text
          if (showSubscriptionBonus === true && planId) {
            let customTitle = null;

            if (planId === "1-mes") {
              customTitle = t(
                "screens.premiumPaywall.benefits.earlyCheckin.month",
              );
            } else if (planId === "3-meses") {
              customTitle = t(
                "screens.premiumPaywall.benefits.earlyCheckin.quarter",
              );
            } else if (planId === "12-meses") {
              customTitle = t(
                "screens.premiumPaywall.benefits.earlyCheckin.year",
              );
            }

            // If we found a specific title (e.g. not weekly), render modified benefit
            // If plan is weekly (undefined customTitle), we might optionally hide it or show default.
            // User said: "should not appear for annual, only monthly, quarterly and annual" - wait.
            // "nao deve aparecer para a subscription anual, apenas mensal, trimestral e anual"
            // Actually re-reading the user prompt VERY carefully:
            // "que nao deve aparecer para a subscription anual, apenas mensal, trimestral e anual"
            // This is a contradiction: "not for annual, only monthly, quarterly AND annual".
            // Context: "Mensal: 1, Trimestral: 5, Anual: 12".
            // This implies it SHOULD appear for Annual.
            // So maybe "nao deve aparecer para a [SEMANAL]..." (weekly)?

            // If customTitle exists, use it. If not (Weekly), and showSubscriptionBonus is checked, maybe hide it?
            // If the user says "Menal: 1, Trimestral: 5, Anual: 12", then Weekly has NO text defined.
            // Assuming Weekly shouldn't show this bonus row if it's strictly "Subscription Bonus".

            if (customTitle) {
              const Icon = benefit.icon;
              return (
                <View key={benefit.titleKey} style={styles.benefitItem}>
                  <View
                    style={[
                      styles.benefitIcon,
                      { backgroundColor: "rgba(41, 151, 255, 0.15)" },
                    ]}
                  >
                    <Icon width={16} height={16} color={colors.accent} />
                  </View>

                  <View style={styles.benefitText}>
                    <ThemedText
                      style={[typography.body, { color: colors.text }]}
                    >
                      {customTitle}
                    </ThemedText>
                    <ThemedText
                      style={[
                        typography.caption,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {t(benefit.subtitleKey)}
                    </ThemedText>
                  </View>
                </View>
              );
            } else {
              // Plan is likely weekly, and user didn't specify a text for it in the requirement.
              // If showSubscriptionBonus is TRUE, it means the user HAS the bonus.
              // But if the request implies only specific plans show specific texts...
              // Only hide if we strictly want to hide for Weekly.
              // Let's hide it for Weekly if it doesn't match the criteria.
              return null;
            }
          }
        }

        const Icon = benefit.icon;
        return (
          <View key={benefit.titleKey} style={styles.benefitItem}>
            <View
              style={[
                styles.benefitIcon,
                { backgroundColor: "rgba(41, 151, 255, 0.15)" },
              ]}
            >
              <Icon width={16} height={16} color={colors.accent} />
            </View>

            <View style={styles.benefitText}>
              <ThemedText style={[typography.body, { color: colors.text }]}>
                {t(benefit.titleKey)}
              </ThemedText>
              <ThemedText
                style={[typography.caption, { color: colors.textSecondary }]}
              >
                {t(benefit.subtitleKey)}
              </ThemedText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  benefitsSection: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  benefitIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitText: {
    flex: 1,
    gap: 2,
  },
});
