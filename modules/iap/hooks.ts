import { useContext, useMemo } from "react";
import { useAppSelector } from "../store/hooks";
import { IAPContext } from "./context";
import { IAPContextValue } from "./types";
import { getPriceValue } from "./utils";

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

export function useSubscription(sku: string | null) {
  const { subscriptions } = useIAP();

  if (!sku) return null;

  // Search by id (new) or productId (legacy/platform specific)
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
          '',
        priceValue: getPriceValue(subscription),
      }
    : null;
}

export function useUserSubscription() {
  const subscription = useAppSelector((state) => state.profile.data?.subscription);

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
