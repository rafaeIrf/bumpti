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
import { t } from "@/modules/locales";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

interface Plan {
  id: string;
  nameKey: string;
  price: string;
  period: string | null;
  badgeKey: string | null;
  savingsKey: string | null;
  isHighlighted: boolean;
}

const PLANS: Plan[] = [
  {
    id: "1-semana",
    nameKey: "screens.premiumPaywall.plans.week",
    price: "19,90",
    period: null,
    badgeKey: "screens.premiumPaywall.plans.mostPopular",
    savingsKey: null,
    isHighlighted: false,
  },
  {
    id: "1-mes",
    nameKey: "screens.premiumPaywall.plans.month",
    price: "49,90",
    period: "screens.premiumPaywall.plans.perMonth",
    badgeKey: null,
    savingsKey: null,
    isHighlighted: true,
  },
  {
    id: "3-meses",
    nameKey: "screens.premiumPaywall.plans.threeMonths",
    price: "39,90",
    period: "screens.premiumPaywall.plans.perMonth",
    badgeKey: "screens.premiumPaywall.plans.bestValue",
    savingsKey: "screens.premiumPaywall.plans.save20",
    isHighlighted: false,
  },
  {
    id: "12-meses",
    nameKey: "screens.premiumPaywall.plans.year",
    price: "29,90",
    period: "screens.premiumPaywall.plans.perMonth",
    badgeKey: null,
    savingsKey: "screens.premiumPaywall.plans.save40",
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
  const [selectedPlan, setSelectedPlan] = useState("1-mes");

  const handleClose = () => {
    router.back();
  };

  const handleSubscribe = () => {
    // TODO: Implement subscription logic
    console.log("Subscribe to plan:", selectedPlan);
    router.back();
  };

  const selectedPlanData = PLANS.find((plan) => plan.id === selectedPlan);
  const selectedPlanPrice = selectedPlanData?.price || "0,00";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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

        {/* Plans Section */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(300)}
          style={[styles.plansSection, { paddingHorizontal: spacing.md }]}
        >
          {PLANS.map((plan, index) => (
            <Pressable
              key={plan.id}
              onPress={() => setSelectedPlan(plan.id)}
              style={[
                styles.planCard,
                {
                  borderWidth: 2,
                  borderColor:
                    selectedPlan === plan.id && !plan.isHighlighted
                      ? colors.accent
                      : "transparent",
                },
              ]}
            >
              {plan.isHighlighted && selectedPlan === plan.id ? (
                <LinearGradient
                  colors={["#2997FF", "#1D7FD9"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.planCardGradient, { borderRadius: 16 }]}
                >
                  {renderPlanContent(plan, selectedPlan, colors, true)}
                </LinearGradient>
              ) : (
                <View
                  style={[
                    styles.planCardGradient,
                    {
                      backgroundColor: plan.isHighlighted
                        ? colors.accent
                        : "#16181C",
                      borderRadius: 16,
                    },
                  ]}
                >
                  {renderPlanContent(
                    plan,
                    selectedPlan,
                    colors,
                    plan.isHighlighted
                  )}
                </View>
              )}
            </Pressable>
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
      <Animated.View
        entering={FadeInUp.duration(400).delay(600)}
        style={[styles.ctaContainer, { borderTopColor: colors.border }]}
      >
        <View
          style={[styles.ctaGradient, { backgroundColor: colors.background }]}
        >
          {/* Terms */}
          <ThemedText
            style={[
              typography.caption,
              { color: colors.textSecondary, textAlign: "center" },
            ]}
          >
            {t("screens.premiumPaywall.terms")}
          </ThemedText>

          {/* CTA Button */}
          <Pressable onPress={handleSubscribe}>
            <LinearGradient
              colors={["#2997FF", "#1D7FD9"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaButton}
            >
              <ThemedText
                style={[
                  typography.body1,
                  { color: "#FFFFFF", fontWeight: "600" },
                ]}
              >
                Assinar - R$ {selectedPlanPrice}
              </ThemedText>
            </LinearGradient>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

function renderPlanContent(
  plan: Plan,
  selectedPlan: string,
  colors: any,
  isHighlighted: boolean
) {
  const isSelected = selectedPlan === plan.id;
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
          {plan.savingsKey && (
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
              {t(plan.savingsKey)}
            </ThemedText>
          )}
        </View>

        {/* Price */}
        <View style={styles.planPriceContainer}>
          <View style={styles.planPrice}>
            <ThemedText
              style={[typography.heading, { color: textColor, fontSize: 22 }]}
            >
              R$ {plan.price}
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
