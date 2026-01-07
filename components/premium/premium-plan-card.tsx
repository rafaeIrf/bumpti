import { PlanRadioButton } from "@/components/plan-radio-button";
import { ThemedText } from "@/components/themed-text";
import { Chip } from "@/components/ui/chip";
import { spacing, typography } from "@/constants/theme";
import { PLAN_CREDITS, PLAN_TYPE_MAP, SKU_MAP } from "@/modules/iap/config";
import { useSubscription } from "@/modules/iap/hooks";
import { t } from "@/modules/locales";
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

// Duration in months for calculation
const PLAN_MONTHS: Record<string, number> = {
  "1-semana": 0.25,
  "1-mes": 1,
  "3-meses": 3,
  "12-meses": 12,
};

interface PremiumPlanCardProps {
  plan: {
    id: string;
    nameKey: string;
    period: string | null;
    badgeKey: string | null;
    isHighlighted: boolean;
  };
  selectedPlanId: string;
  onSelect: (id: string) => void;
  colors: any;
  baseMonthlyPrice: number | null;
  isCurrentPlan?: boolean;
  disabled?: boolean;
  currentPlanLabel?: string;
  showSubscriptionBonus?: boolean;
}

export function PremiumPlanCard({
  plan,
  selectedPlanId,
  onSelect,
  colors,
  baseMonthlyPrice,
  isCurrentPlan = false,
  disabled = false,
  currentPlanLabel,
  showSubscriptionBonus = true,
}: PremiumPlanCardProps) {
  const isSelected = selectedPlanId === plan.id;

  // Use the hook with shared config
  const sku = SKU_MAP[plan.id];
  const planType = PLAN_TYPE_MAP[plan.id];
  const subscription = useSubscription(sku, planType);

  // Calculate display price (monthly equivalent for multi-month plans)
  const displayPrice = useMemo(() => {
    if (!subscription) return "";

    // For multi-month plans, we want to show the monthly price
    if (PLAN_MONTHS[plan.id] > 1 && subscription.priceValue) {
      const rawMonthly = subscription.priceValue / PLAN_MONTHS[plan.id];
      // Explicitly round: 3rd decimal >= 5 rounds up (standard Math.round behavior)
      const monthlyValue = Math.round(rawMonthly * 100) / 100;
      try {
        return new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: subscription.currency || "BRL", // Fallback to BRL if currency missing
        }).format(monthlyValue);
      } catch {
        // Fallback formatting if Intl fails
        return monthlyValue.toFixed(2);
      }
    }

    return subscription.formattedPrice || "";
  }, [plan.id, subscription]);

  // Calculate dynamic savings
  const savingsLabel = useMemo(() => {
    if (
      baseMonthlyPrice &&
      subscription?.priceValue &&
      PLAN_MONTHS[plan.id] > 1
    ) {
      const months = PLAN_MONTHS[plan.id];
      const unitPrice = subscription.priceValue / months;
      const discount =
        ((baseMonthlyPrice - unitPrice) / baseMonthlyPrice) * 100;
      if (discount > 0) {
        return t("screens.premiumPaywall.plans.savePercent", {
          percent: Math.round(discount),
        });
      }
    }
    return null;
  }, [plan.id, baseMonthlyPrice, subscription?.priceValue]);

  const textColor = plan.isHighlighted ? "#FFFFFF" : colors.text;
  const secondaryColor = plan.isHighlighted
    ? "rgba(255, 255, 255, 0.8)"
    : colors.textSecondary;

  const renderContent = () => (
    <>
      <View style={styles.planContent}>
        <View style={styles.planInfo}>
          {/* Plan name */}
          <ThemedText
            style={[typography.body, { color: textColor, fontWeight: "600" }]}
          >
            {t(plan.nameKey)}
          </ThemedText>

          {/* Savings */}
          {savingsLabel && !isCurrentPlan && (
            <ThemedText
              style={[
                typography.caption,
                {
                  color: plan.isHighlighted
                    ? "rgba(255, 255, 255, 0.9)"
                    : colors.accent,
                  fontWeight: "600",
                },
              ]}
            >
              {savingsLabel}
            </ThemedText>
          )}

          {/* Check-in Bonus */}
          {showSubscriptionBonus &&
            !isCurrentPlan &&
            (PLAN_CREDITS[plan.id] || 0) > 0 && (
              <Chip
                label={t("screens.premiumPaywall.plans.checkinBonus", {
                  count: PLAN_CREDITS[plan.id],
                })}
                color={plan.isHighlighted ? "#FFFFFF" : colors.accent}
                size="sm"
                style={{ marginTop: 6, alignSelf: "flex-start" }}
              />
            )}
        </View>

        {/* Price */}
        <View style={styles.planPriceContainer}>
          <View style={styles.planPrice}>
            <ThemedText
              style={[typography.heading, { color: textColor, fontSize: 22 }]}
            >
              {displayPrice}
            </ThemedText>
            {plan.period && (
              <ThemedText
                style={[typography.caption, { color: secondaryColor }]}
              >
                /{t(plan.period)}
              </ThemedText>
            )}
          </View>

          {/* Radio indicator */}
          <PlanRadioButton
            isSelected={isSelected}
            isHighlighted={plan.isHighlighted}
            accentColor={colors.accent}
            // Use checkmark for current plan instead of radio if locked
            isLocked={isCurrentPlan}
          />
        </View>
      </View>
    </>
  );

  return (
    <Pressable
      onPress={() => !disabled && onSelect(plan.id)}
      disabled={disabled}
      style={[
        styles.planCard,
        {
          borderWidth: 2,
          borderColor:
            isSelected && !plan.isHighlighted
              ? isCurrentPlan
                ? colors.success ?? "#34C759"
                : colors.accent
              : "transparent",
          opacity: disabled && !isCurrentPlan ? 0.5 : 1, // Dim other plans if everything is disabled, but usually current plan is disabled but full opacity
        },
      ]}
    >
      <View style={{ zIndex: 1 }}>
        {/* Badge */}
        {plan.badgeKey && !isCurrentPlan && (
          <View
            style={[
              styles.planBadge,
              {
                backgroundColor: plan.isHighlighted ? "#000000" : colors.accent,
              },
            ]}
          >
            <ThemedText
              style={[
                typography.caption,
                { color: "#FFFFFF", fontWeight: "600", fontSize: 10 },
              ]}
            >
              {t(plan.badgeKey)}
            </ThemedText>
          </View>
        )}

        {/* Current Plan Badge */}
        {isCurrentPlan && currentPlanLabel && (
          <View
            style={[
              styles.planBadge,
              {
                backgroundColor: colors.success ?? "#34C759",
              },
            ]}
          >
            <ThemedText
              style={[
                typography.caption,
                { color: "#FFFFFF", fontWeight: "600", fontSize: 10 },
              ]}
            >
              {currentPlanLabel}
            </ThemedText>
          </View>
        )}
      </View>

      {plan.isHighlighted && isSelected ? (
        <LinearGradient
          colors={["#2997FF", "#1D7FD9"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.planCardGradient, { borderRadius: 16 }]}
        >
          {renderContent()}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.planCardGradient,
            {
              backgroundColor: plan.isHighlighted ? colors.accent : "#16181C",
              borderRadius: 16,
            },
          ]}
        >
          {renderContent()}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  planCard: {
    borderRadius: 16,
    overflow: "visible",
    marginTop: spacing.sm,
  },
  planCardGradient: {
    padding: spacing.lg,
  },
  planBadge: {
    position: "absolute",
    top: -8,
    left: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  planContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  planInfo: {
    flex: 1,
  },
  planPriceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  planPrice: {
    alignItems: "flex-end",
  },
});
