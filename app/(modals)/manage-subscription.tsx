import { XIcon } from "@/assets/icons";
import { PremiumBenefits } from "@/components/premium/premium-benefits";
import { PremiumPlanCard } from "@/components/premium/premium-plan-card";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { spacing, typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { PLAN_TYPE_MAP, SKU_MAP } from "@/modules/iap/config";
import {
  useIAP,
  useSubscription,
  useUserSubscription,
} from "@/modules/iap/hooks";
import { t } from "@/modules/locales";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

export default function ManageSubscriptionScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { requestSubscription, purchasing } = useIAP();

  const userSubscription = useUserSubscription();

  // Normalize backend plan string to our UI internal IDs ("1-mes", etc.)
  const currentPlanId = useMemo(() => {
    const plan = userSubscription?.plan;
    if (!plan) return null;

    // If it's already a valid ID
    if (plan in PLAN_TYPE_MAP) return plan;

    // If it's a plan type (e.g. "month"), find the key
    const foundEntry = Object.entries(PLAN_TYPE_MAP).find(
      ([key, value]) => value === plan
    );
    return foundEntry ? foundEntry[0] : null;
  }, [userSubscription?.plan]);

  // Initialize selection with current plan if available, otherwise default
  const [selectedPlanId, setSelectedPlanId] = useState(
    currentPlanId || "1-mes"
  );

  // Update selection if currentPlanId changes (e.g. initial load)
  useEffect(() => {
    if (currentPlanId) {
      setSelectedPlanId(currentPlanId);
    }
  }, [currentPlanId]);

  // Check if the user selected a DIFFERENT plan than their current one
  const isPlanChanged = currentPlanId && selectedPlanId !== currentPlanId;

  // Get base monthly price for calculations (from paywall logic)
  const monthlySku = SKU_MAP["1-mes"];
  const monthlySub = useSubscription(monthlySku);
  const baseMonthlyPrice = monthlySub?.priceValue ?? null;

  const handleClose = () => {
    router.back();
  };

  const handleAction = async () => {
    if (isPlanChanged) {
      // Update Plan Logic (Purchase new SKU)
      if (purchasing) return;
      const sku = SKU_MAP[selectedPlanId];
      const planType = PLAN_TYPE_MAP[selectedPlanId];

      if (sku) {
        await requestSubscription(sku, planType);
      }
    } else {
      // Manage Subscription Logic (Open Store)
      if (Platform.OS === "ios") {
        Linking.openURL("https://apps.apple.com/account/subscriptions");
      } else {
        Linking.openURL("https://play.google.com/store/account/subscriptions");
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Close Button */}
      <Animated.View
        entering={FadeInUp.duration(400)}
        style={[
          styles.closeButton,
          {
            top: Platform.select({
              ios: spacing.md,
              android: insets.top + spacing.md,
            }),
          },
        ]}
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
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 160 + insets.bottom },
        ]}
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
            {/* Title */}
            <ThemedText style={[typography.heading, styles.heroTitle]}>
              {t("screens.manageSubscription.title")}
            </ThemedText>

            {/* Subtitle */}
            <ThemedText style={[typography.body, styles.heroSubtitle]}>
              {t("screens.manageSubscription.subtitle")}
            </ThemedText>
          </Animated.View>
        </View>

        {/* Benefits Section */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(200)}
          style={[styles.section, { paddingHorizontal: spacing.md }]}
        >
          <ThemedText
            style={[
              typography.heading2,
              { color: colors.text, marginBottom: spacing.md },
            ]}
          >
            {t("screens.profile.premium.active.cta")}
          </ThemedText>
          <PremiumBenefits
            planId={selectedPlanId}
            showSubscriptionBonus={true}
          />
        </Animated.View>

        {/* Plans Section */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(300)}
          style={[styles.section, { paddingHorizontal: spacing.md }]}
        >
          <ThemedText
            style={[
              typography.heading2,
              { color: colors.text, marginBottom: spacing.md },
            ]}
          >
            {t("screens.manageSubscription.updatePlan")}
          </ThemedText>

          {PLAN_DEFAULTS.map((plan) => {
            const isCurrent = currentPlanId === plan.id;
            return (
              <PremiumPlanCard
                key={plan.id}
                plan={plan}
                selectedPlanId={selectedPlanId}
                onSelect={setSelectedPlanId}
                colors={colors}
                baseMonthlyPrice={baseMonthlyPrice}
                isCurrentPlan={isCurrent}
                disabled={false}
                currentPlanLabel={t("screens.manageSubscription.currentPlan")}
              />
            );
          })}
        </Animated.View>
      </ScrollView>

      {/* Fixed CTA at bottom */}
      <Animated.View
        entering={FadeInUp.duration(400).delay(400)}
        style={[styles.ctaContainer, { borderTopColor: colors.border }]}
      >
        <View
          style={[
            styles.ctaGradient,
            {
              backgroundColor: colors.background,
              paddingBottom: spacing.md + (insets?.bottom ?? 0),
            },
          ]}
        >
          <Button
            onPress={handleAction}
            label={
              isPlanChanged
                ? t("screens.manageSubscription.updatePlan")
                : t("screens.manageSubscription.manage")
            }
            loading={purchasing}
            fullWidth
            size="lg"
            variant={isPlanChanged ? "primary" : "secondary"}
          />
        </View>
      </Animated.View>
    </View>
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
    height: Platform.select({ ios: 200, android: 240, default: 220 }),
    position: "relative",
    marginBottom: spacing.lg,
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
  heroTitle: {
    color: "#FFFFFF",
    marginBottom: spacing.xs,
    fontSize: 24,
  },
  heroSubtitle: {
    color: "rgba(255, 255, 255, 0.9)",
  },
  section: {
    marginBottom: spacing.xl,
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
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
});
