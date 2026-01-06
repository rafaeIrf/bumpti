import { Subscription as ExpoSubscription, Product } from "expo-iap";

export interface Subscription extends ExpoSubscription {
  localizedPrice?: string;
  displayPrice?: string;
  currency?: string;
  id?: string;
}

export type PlanType = "week" | "month" | "threeMonths" | "year";

export interface IAPState {
  connected: boolean;
  loading: boolean;
  purchasing: boolean;
  products: Product[];
  subscriptions: Subscription[];
  error: string | null;
}

export interface IAPContextValue extends IAPState {
  requestPurchase: (sku: string) => Promise<void>;
  requestSubscription: (sku: string, planType?: PlanType) => Promise<void>;
  restorePurchases: () => Promise<void>;
  refreshProducts: () => Promise<void>;
}

export type PurchaseType = "subscription" | "consumable";
