import { Platform } from "react-native";

import { PlanType } from "./types";

// iOS: continua com SKUs separados
// Android: usa um único productId com base plans
export const IAP_SKUS = {
  subscriptions: {
    week: Platform.select({
      ios: "bumpti_premium_weekly",
      android: "bumpti_premium",
    })!,
    month: Platform.select({
      ios: "bumpti_premium_monthly",
      android: "bumpti_premium",
    })!,
    threeMonths: Platform.select({
      ios: "bumpti_premium_quarterly",
      android: "bumpti_premium",
    })!,
    year: Platform.select({
      ios: "bumpti_premium_yearly",
      android: "bumpti_premium",
    })!,
  },
  consumables: {
    checkin1: Platform.select({
      ios: "bumpti_checkin_pack_1",
      android: "bumpti_checkin_pack_1",
    })!,
    checkin5: Platform.select({
      ios: "bumpti_checkin_pack_5",
      android: "bumpti_checkin_pack_5",
    })!,
    checkin10: Platform.select({
      ios: "bumpti_checkin_pack_10",
      android: "bumpti_checkin_pack_10",
    })!,
  },
};

// Mapeamento de plano para basePlanId (Android)
export const ANDROID_BASE_PLAN_MAP: Record<string, string> = {
  week: "premium-weekly",
  month: "premium-monthly",
  threeMonths: "premium-quarterly",
  year: "premium-yearly",
};

// SKU único para Android subscriptions
export const ANDROID_SUBSCRIPTION_PRODUCT_ID = "bumpti_premium";

// Para fetchProducts - SKUs únicos por plataforma
export const SUBSCRIPTION_SKUS = Platform.select({
  ios: [
    "bumpti_premium_weekly",
    "bumpti_premium_monthly",
    "bumpti_premium_quarterly",
    "bumpti_premium_yearly",
  ],
  android: ["bumpti_premium"],
})!;

export const CONSUMABLE_SKUS = Object.values(IAP_SKUS.consumables);
export const ALL_SKUS = [...SUBSCRIPTION_SKUS, ...CONSUMABLE_SKUS];

// Map our internal IDs to IAP SKUs
export const SKU_MAP: Record<string, string> = {
  "1-semana": IAP_SKUS.subscriptions.week,
  "1-mes": IAP_SKUS.subscriptions.month,
  "3-meses": IAP_SKUS.subscriptions.threeMonths,
  "12-meses": IAP_SKUS.subscriptions.year,
};

// Map internal IDs to PlanType for Android base plans
export const PLAN_TYPE_MAP: Record<string, PlanType> = {
  "1-semana": "week",
  "1-mes": "month",
  "3-meses": "threeMonths",
  "12-meses": "year",
};
