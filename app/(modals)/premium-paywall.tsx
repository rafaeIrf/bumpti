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
import { openTermsOfUse } from "@/utils";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { XIcon } from "@/assets/icons";

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
    nameKey: "screens.premiumPaywall.plans.quarterly",
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

export default function PremiumPaywallScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [selectedPlanId, setSelectedPlanId] = useState("1-mes");
  const insets = useSafeAreaInsets();
  const { requestSubscription, purchasing } = useIAP();
  const { showSubscriptionBonus } = useUserSubscription();

  // Get base monthly price for calculations
  const monthlySku = SKU_MAP["1-mes"];
  const monthlyPlanType = PLAN_TYPE_MAP["1-mes"];
  const monthlySub = useSubscription(monthlySku, monthlyPlanType);
  const baseMonthlyPrice = monthlySub?.priceValue ?? null;

  const handleClose = () => {
    router.back();
  };

  const handleSubscribe = async () => {
    if (purchasing) return;

    const sku = SKU_MAP[selectedPlanId];
    const planType = PLAN_TYPE_MAP[selectedPlanId];

    if (sku) {
      console.log("Subscribing to:", { sku, planType });
      await requestSubscription(sku, planType, () => router.back());
    } else {
      console.warn("No SKU found for plan", selectedPlanId);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
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
            <PremiumPlanCard
              key={plan.id}
              plan={plan}
              selectedPlanId={selectedPlanId}
              onSelect={setSelectedPlanId}
              colors={colors}
              baseMonthlyPrice={baseMonthlyPrice}
              showSubscriptionBonus={showSubscriptionBonus}
            />
          ))}
        </Animated.View>

        {/* Benefits Section */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(400)}
          style={{ paddingHorizontal: spacing.md }}
        >
          <PremiumBenefits
            planId={selectedPlanId}
            showSubscriptionBonus={showSubscriptionBonus}
          />
        </Animated.View>
      </ScrollView>

      {/* Fixed CTA at bottom */}
      <BottomCTA
        selectedPlanId={selectedPlanId}
        handleSubscribe={handleSubscribe}
        purchasing={purchasing}
        colors={colors}
        insets={insets}
      />
    </View>
  );
}

function BottomCTA({
  selectedPlanId,
  handleSubscribe,
  purchasing,
  colors,
  insets,
}: any) {
  const sku = SKU_MAP[selectedPlanId];
  const planType = PLAN_TYPE_MAP[selectedPlanId];
  const subscription = useSubscription(sku, planType);
  // Find default price for fallback
  const price = subscription?.formattedPrice || "";

  return (
    <Animated.View
      entering={FadeInUp.duration(400).delay(600)}
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
        {/* Terms */}
        <ThemedText
          style={[
            typography.caption,
            {
              color: colors.textSecondary,
              textAlign: "center",
              marginBottom: spacing.xs,
              paddingHorizontal: spacing.sm,
            },
          ]}
        >
          {t("screens.premiumPaywall.terms", {
            store: Platform.OS === "ios" ? "App Store" : "Play Store",
          })}{" "}
          <ThemedText
            variant="caption"
            onPress={openTermsOfUse}
            style={{ color: colors.accent, fontWeight: "600" }}
          >
            {t("screens.premiumPaywall.termsLink")}
          </ThemedText>
          .
        </ThemedText>

        {/* CTA Button */}
        <Button
          onPress={handleSubscribe}
          label={`${t("common.subscribe")} - ${price}`}
          loading={purchasing}
          fullWidth
          size="lg"
        />
      </View>
    </Animated.View>
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
    height: Platform.select({ ios: 220, android: 260, default: 256 }),
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
    gap: spacing.xs,
  },
});
