import { useContext, useMemo } from "react";
import { Platform } from "react-native";

import { useAppSelector } from "../store/hooks";
import {
    ANDROID_BASE_PLAN_MAP,
    ANDROID_SUBSCRIPTION_PRODUCT_ID,
} from "./config";
import { IAPContext } from "./context";
import { IAPContextValue, PlanType } from "./types";
import { getPriceForBasePlan, getPriceValue } from "./utils";

export function useIAP(): IAPContextValue {
  const context = useContext(IAPContext);
  if (!context) {
    throw new Error("useIAP must be used within an IAPProvider");
  }
  return context;
}

export function useSubscriptions() {
  const { subscriptions, loading, error } = useIAP();
  return { subscriptions, loading, error };
}

export function useProducts() {
  const { products, loading, error } = useIAP();
  return { products, loading, error };
}

export function useSubscription(sku: string | null, planType?: PlanType) {
  const { subscriptions } = useIAP();

  if (!sku) return null;

  // Android com novo modelo: 1 subscription com base plans
  if (Platform.OS === "android" && planType) {
    const subscription = subscriptions.find(
      (s) =>
        s.id === ANDROID_SUBSCRIPTION_PRODUCT_ID ||
        (s as any).productId === ANDROID_SUBSCRIPTION_PRODUCT_ID
    );

    if (subscription) {
      const basePlanId = ANDROID_BASE_PLAN_MAP[planType];
      const priceInfo = getPriceForBasePlan(subscription, basePlanId);

      return {
        ...subscription,
        formattedPrice: priceInfo?.formattedPrice || "",
        priceValue: priceInfo ? priceInfo.priceAmountMicros / 1_000_000 : null,
        basePlanId,
      };
    }
  }

  // iOS ou fallback (SKUs separados)
  const subscription = subscriptions.find(
    (s) => s.id === sku || (s as any).productId === sku
  );

  return subscription
    ? {
        ...subscription,
        formattedPrice:
          subscription.displayPrice ||
          subscription.localizedPrice ||
          (subscription as any).price ||
          "",
        priceValue: getPriceValue(subscription),
      }
    : null;
}

export function useUserSubscription() {
  const subscription = useAppSelector(
    (state) => state.profile.data?.subscription
  );

  return useMemo(() => {
    return {
      subscription,
      isPremium: subscription?.is_premium ?? false,
      plan: subscription?.plan,
      checkinCredits: subscription?.checkin_credits ?? 0,
      premiumExpiresAt: subscription?.premium_expires_at,
      showSubscriptionBonus: subscription?.show_subscription_bonus ?? false,
    };
  }, [subscription]);
}
