import {
  CheckIcon,
  FlameIcon,
  HeartIcon,
  MapPinIcon,
  NavigationIcon,
  SearchIcon,
  SparklesIcon,
  UsersIcon,
  XIcon,
} from "@/assets/icons";
import { PlanRadioButton } from "@/components/plan-radio-button";
import { ThemedText } from "@/components/themed-text";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { IAP_SKUS } from "@/modules/iap/config";
import {
  useIAP,
  useSubscription,
  useUserSubscription,
} from "@/modules/iap/hooks";
import { t } from "@/modules/locales";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Map our internal IDs to IAP SKUs
const SKU_MAP: Record<string, string> = {
  "1-semana": IAP_SKUS.subscriptions.week,
  "1-mes": IAP_SKUS.subscriptions.month,
  "3-meses": IAP_SKUS.subscriptions.threeMonths,
  "12-meses": IAP_SKUS.subscriptions.year,
};

// Duration in months for calculation
const PLAN_MONTHS: Record<string, number> = {
  "1-semana": 0.25,
  "1-mes": 1,
  "3-meses": 3,
  "12-meses": 12,
};

const PLAN_DEFAULTS = [
  {
    id: "1-semana",
    nameKey: "screens.premiumPaywall.plans.week",
    period: null,
    badgeKey: "screens.premiumPaywall.plans.mostPopular",
    isHighlighted: false,
  },
  {
    id: "1-mes",
    nameKey: "screens.premiumPaywall.plans.month",
    period: "screens.premiumPaywall.plans.perMonth",
    badgeKey: null,
    isHighlighted: true,
  },
  {
    id: "3-meses",
    nameKey: "screens.premiumPaywall.plans.threeMonths",
    period: "screens.premiumPaywall.plans.perMonth",
    badgeKey: null,
    isHighlighted: false,
  },
  {
    id: "12-meses",
    nameKey: "screens.premiumPaywall.plans.year",
    period: "screens.premiumPaywall.plans.perMonth",
    badgeKey: "screens.premiumPaywall.plans.bestValue",
    isHighlighted: false,
  },
];

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
  {
    icon: SearchIcon,
    titleKey: "screens.premiumPaywall.benefits.seeWhoViewed.title",
    subtitleKey: "screens.premiumPaywall.benefits.seeWhoViewed.subtitle",
  },
  {
    icon: FlameIcon,
    titleKey: "screens.premiumPaywall.benefits.turboIncluded.title",
    subtitleKey: "screens.premiumPaywall.benefits.turboIncluded.subtitle",
  },
  {
    icon: MapPinIcon,
    titleKey: "screens.premiumPaywall.benefits.earlyCheckin.title",
    subtitleKey: "screens.premiumPaywall.benefits.earlyCheckin.subtitle",
  },
  {
    icon: NavigationIcon,
    titleKey: "screens.premiumPaywall.benefits.pings.title",
    subtitleKey: "screens.premiumPaywall.benefits.pings.subtitle",
  },
];

export default function PremiumPaywallScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [selectedPlanId, setSelectedPlanId] = useState("1-mes");
  const insets = useSafeAreaInsets();
  const { isPremium } = useUserSubscription();
  const { requestSubscription, purchasing, restorePurchases } = useIAP();

  // Get base monthly price for calculations
  const monthlySku = SKU_MAP["1-mes"];
  const monthlySub = useSubscription(monthlySku);
  const baseMonthlyPrice = monthlySub?.priceValue ?? null;

  const handleClose = () => {
    router.back();
  };

  const handleSubscribe = async () => {
    if (purchasing) return;

    const sku = SKU_MAP[selectedPlanId];
    if (sku) {
      console.log("Subscribing to SKU:", sku);
      await requestSubscription(sku);
    } else {
      console.warn("No SKU found for plan", selectedPlanId);
    }
  };

  const handleRestore = async () => {
    await restorePurchases();
    // Optionally show alert on success/failure based on context state
    Alert.alert(
      t("common.success"),
      t("screens.premiumPaywall.restoreSuccess")
    );
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          marginBottom: insets.bottom,
          marginTop: insets.top,
        },
      ]}
    >
      {/* Close Button */}
      <Animated.View
        entering={FadeInUp.duration(400)}
        style={styles.closeButton}
      >
        <Pressable
          onPress={handleClose}
          style={({ pressed }) => [
            styles.closeButtonInner,
            {
              backgroundColor: pressed
                ? "rgba(0, 0, 0, 0.6)"
                : "rgba(0, 0, 0, 0.4)",
            },
          ]}
        >
          <XIcon width={20} height={20} color="#FFFFFF" />
        </Pressable>
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Image Section */}
        <View style={styles.heroSection}>
          <Image
            source={{
              uri: "https://images.unsplash.com/photo-1746003625451-fb19865e19b0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080",
            }}
            style={styles.heroImage}
          />
          <LinearGradient
            colors={["rgba(0, 0, 0, 0.3)", "rgba(0, 0, 0, 0.8)"]}
            style={styles.heroOverlay}
          />

          {/* Hero Content */}
          <Animated.View
            entering={FadeInDown.duration(400)}
            style={styles.heroContent}
          >
            {/* Badge */}
            <View style={styles.badge}>
              <ThemedText
                style={[
                  typography.caption,
                  { color: "#000000", fontWeight: "600" },
                ]}
              >
                {t("screens.premiumPaywall.badge")}
              </ThemedText>
            </View>

            {/* Title */}
            <ThemedText style={[typography.heading, styles.heroTitle]}>
              {t("screens.premiumPaywall.title")}
            </ThemedText>

            {/* Subtitle */}
            <ThemedText style={[typography.body, styles.heroSubtitle]}>
              {t("screens.premiumPaywall.subtitle")}
            </ThemedText>
          </Animated.View>
        </View>

        <Animated.View
          entering={FadeInDown.duration(400).delay(300)}
          style={[styles.plansSection, { paddingHorizontal: spacing.md }]}
        >
          {PLAN_DEFAULTS.map((plan) => (
            <PlanItem
              key={plan.id}
              plan={plan}
              selectedPlanId={selectedPlanId}
              onSelect={setSelectedPlanId}
              colors={colors}
              baseMonthlyPrice={baseMonthlyPrice}
            />
          ))}
        </Animated.View>

        {/* Benefits Section */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(400)}
          style={[styles.benefitsSection, { paddingHorizontal: spacing.md }]}
        >
          {BENEFITS.map((benefit) => {
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
          })}
        </Animated.View>
      </ScrollView>

      {/* Fixed CTA at bottom */}
      <BottomCTA
        selectedPlanId={selectedPlanId}
        handleSubscribe={handleSubscribe}
        handleRestore={handleRestore}
        purchasing={purchasing}
        colors={colors}
      />
    </View>
  );
}

function BottomCTA({
  selectedPlanId,
  handleSubscribe,
  handleRestore,
  purchasing,
  colors,
}: any) {
  const sku = SKU_MAP[selectedPlanId];
  const subscription = useSubscription(sku);
  // Find default price for fallback
  const price = subscription?.formattedPrice || "";

  return (
    <Animated.View
      entering={FadeInUp.duration(400).delay(600)}
      style={[styles.ctaContainer, { borderTopColor: colors.border }]}
    >
      <View
        style={[styles.ctaGradient, { backgroundColor: colors.background }]}
      >
        {/* Terms & Restore */}
        <View style={{ gap: 4, marginBottom: spacing.sm }}>
          <ThemedText
            style={[
              typography.caption,
              { color: colors.textSecondary, textAlign: "center" },
            ]}
          >
            {t("screens.premiumPaywall.terms")}
          </ThemedText>
          <Pressable onPress={handleRestore}>
            <ThemedText
              style={[
                typography.caption,
                {
                  color: colors.textSecondary,
                  textAlign: "center",
                  textDecorationLine: "underline",
                },
              ]}
            >
              {t("actions.restore")}
            </ThemedText>
          </Pressable>
        </View>

        {/* CTA Button */}
        <Pressable onPress={handleSubscribe}>
          <LinearGradient
            colors={["#2997FF", "#1D7FD9"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaButton}
          >
            {purchasing ? (
              <ActivityIndicator color="white" />
            ) : (
              <ThemedText
                style={[
                  typography.body1,
                  { color: "#FFFFFF", fontWeight: "600" },
                ]}
              >
                {t("common.subscribe")} - {price}
              </ThemedText>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </Animated.View>
  );
}

function PlanItem({
  plan,
  selectedPlanId,
  onSelect,
  colors,
  baseMonthlyPrice,
}: {
  plan: any;
  selectedPlanId: string;
  onSelect: (id: string) => void;
  colors: any;
  baseMonthlyPrice: number | null;
}) {
  const isSelected = selectedPlanId === plan.id;

  // Use the new reusable hook
  const sku = SKU_MAP[plan.id];
  const subscription = useSubscription(sku);

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

  return (
    <Pressable
      onPress={() => onSelect(plan.id)}
      style={[
        styles.planCard,
        {
          borderWidth: 2,
          borderColor:
            isSelected && !plan.isHighlighted ? colors.accent : "transparent",
        },
      ]}
    >
      {plan.isHighlighted && isSelected ? (
        <LinearGradient
          colors={["#2997FF", "#1D7FD9"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.planCardGradient, { borderRadius: 16 }]}
        >
          {renderPlanContent(
            plan,
            displayPrice,
            savingsLabel,
            isSelected,
            colors,
            true
          )}
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
          {renderPlanContent(
            plan,
            displayPrice,
            savingsLabel,
            isSelected,
            colors,
            plan.isHighlighted
          )}
        </View>
      )}
    </Pressable>
  );
}

function renderPlanContent(
  plan: any,
  price: string, // Price passed explicitly
  savingsLabel: string | null, // Pre-calculated savings label
  isSelected: boolean,
  colors: any,
  isHighlighted: boolean
) {
  const textColor = isHighlighted ? "#FFFFFF" : colors.text;
  const secondaryColor = isHighlighted
    ? "rgba(255, 255, 255, 0.8)"
    : colors.textSecondary;

  return (
    <>
      {/* Badge */}
      {plan.badgeKey && (
        <View
          style={[
            styles.planBadge,
            {
              backgroundColor: isHighlighted ? "#000000" : colors.accent,
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

      <View style={styles.planContent}>
        <View style={styles.planInfo}>
          {/* Plan name */}
          <ThemedText
            style={[typography.body, { color: textColor, fontWeight: "600" }]}
          >
            {t(plan.nameKey)}
          </ThemedText>

          {/* Savings */}
          {savingsLabel && (
            <ThemedText
              style={[
                typography.caption,
                {
                  color: isHighlighted
                    ? "rgba(255, 255, 255, 0.9)"
                    : colors.accent,
                  fontWeight: "600",
                },
              ]}
            >
              {savingsLabel}
            </ThemedText>
          )}
        </View>

        {/* Price */}
        <View style={styles.planPriceContainer}>
          <View style={styles.planPrice}>
            <ThemedText
              style={[typography.heading, { color: textColor, fontSize: 22 }]}
            >
              {price}
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
            isHighlighted={isHighlighted}
            accentColor={colors.accent}
          />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  closeButton: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    zIndex: 20,
  },
  closeButtonInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 160,
  },
  heroSection: {
    height: 256,
    position: "relative",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: spacing.sm,
  },
  heroTitle: {
    color: "#FFFFFF",
    marginBottom: spacing.xs,
    fontSize: 28,
  },
  heroSubtitle: {
    color: "rgba(255, 255, 255, 0.9)",
  },
  plansSection: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
    marginTop: spacing.sm,
  },
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
  ctaContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
  },
  ctaGradient: {
    padding: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  ctaButton: {
    paddingVertical: spacing.md,
    borderRadius: 25,
    alignItems: "center",
    shadowColor: "#2997FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 8,
  },
});
