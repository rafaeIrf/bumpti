import { Platform } from "react-native";

export const IAP_SKUS = {
  subscriptions: {
    week: Platform.select({
      ios: "bumpti_premium_weekly",
      android: "bumpti_premium_weekly",
    })!,
    month: Platform.select({
      ios: "bumpti_premium_monthly",
      android: "bumpti_premium_monthly",
    })!,
    threeMonths: Platform.select({
      ios: "bumpti_premium_quarterly",
      android: "bumpti_premium_quarterly",
    })!,
    year: Platform.select({
      ios: "bumpti_premium_yearly",
      android: "bumpti_premium_yearly",
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

export const SUBSCRIPTION_SKUS = Object.values(IAP_SKUS.subscriptions);
export const CONSUMABLE_SKUS = Object.values(IAP_SKUS.consumables);
export const ALL_SKUS = [...SUBSCRIPTION_SKUS, ...CONSUMABLE_SKUS];
