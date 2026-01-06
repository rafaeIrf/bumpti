import {
  Product,
  Subscription,
  endConnection,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  requestPurchase as iapRequestPurchase,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
} from "expo-iap";
import React, {
  PropsWithChildren,
  createContext,
  useCallback,
  useEffect,
  useState,
} from "react";
import { Platform } from "react-native";

import { t } from "@/modules/locales";
import { getCurrentUserId } from "@/modules/store/selectors/profile";
import { handlePurchaseSuccess } from "@/modules/store/slices/profileActions";
import { logger } from "@/utils/logger";
import { validateReceiptWithBackend } from "./api";
import {
  ANDROID_BASE_PLAN_MAP,
  ANDROID_SUBSCRIPTION_PRODUCT_ID,
  CONSUMABLE_SKUS,
  SUBSCRIPTION_SKUS,
} from "./config";
import { IAPContextValue, IAPState, PlanType } from "./types";
import {
  getAndroidSubscriptionOfferToken,
  getOfferTokenByBasePlan,
} from "./utils";

const initialState: IAPState = {
  connected: false,
  loading: true,
  purchasing: false,
  products: [],
  subscriptions: [],
  error: null,
};

export const IAPContext = createContext<IAPContextValue | null>(null);

export function IAPProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<IAPState>(initialState);

  // Initialize connection and fetch products
  const initializeIAP = useCallback(async () => {
    try {
      const connected = await initConnection();

      setState((prev) => ({ ...prev, connected, loading: true }));

      if (connected) {
        await fetchStoreItems();
      }
    } catch (error) {
      logger.error("[IAP] Initialization error:", error);
      setState((prev) => ({
        ...prev,
        error: "Failed to connect to store",
        loading: false,
      }));
    }
  }, []);

  // Fetch products and subscriptions from stores
  const fetchStoreItems = async () => {
    try {
      const [products, subscriptions] = await Promise.all([
        fetchProducts({ skus: CONSUMABLE_SKUS, type: "in-app" }),
        fetchProducts({ skus: SUBSCRIPTION_SKUS, type: "subs" }),
      ]);
      logger.log("[IAP] Subscriptions fetched:", subscriptions);
      logger.log("[IAP] Products fetched:", products);

      setState((prev) => ({
        ...prev,
        products: products as Product[],
        subscriptions: subscriptions as unknown as Subscription[],
        loading: false,
      }));
    } catch (error) {
      logger.error("[IAP] Fetch products error:", error);
      setState((prev) => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    initializeIAP();

    return () => {
      endConnection();
    };
  }, [initializeIAP]);

  // Handle purchase updates
  useEffect(() => {
    const purchaseUpdateSubscription = purchaseUpdatedListener(
      async (purchase: any) => {
        const receipt = purchase.transactionReceipt;
        const token = purchase.purchaseToken;
        logger.log("[IAP] Purchase update received:", purchase);

        if (receipt || token) {
          try {
            const isConsumable = CONSUMABLE_SKUS.includes(purchase.productId);

            const entitlements = await validateReceiptWithBackend(
              purchase,
              isConsumable
            );

            if (entitlements) {
              await finishTransaction({ purchase, isConsumable });
              handlePurchaseSuccess(entitlements);

              logger.log(
                "[IAP] Purchase finished successfully:",
                purchase.productId
              );
            } else {
              logger.warn(
                "[IAP] Receipt validation failed for:",
                purchase.productId
              );
            }
          } catch (error) {
            logger.error("[IAP] Error processing purchase:", error);
          }
        }

        setState((prev) => ({ ...prev, purchasing: false }));
      }
    );

    const purchaseErrorSubscription = purchaseErrorListener((error: any) => {
      logger.warn("[IAP] Purchase error:", error);
      setState((prev) => ({
        ...prev,
        purchasing: false,
        error: error.message || "Purchase failed",
      }));
    });

    return () => {
      if (purchaseUpdateSubscription) {
        purchaseUpdateSubscription.remove();
      }
      if (purchaseErrorSubscription) {
        purchaseErrorSubscription.remove();
      }
    };
  }, []);

  const requestPurchase = async (sku: string) => {
    try {
      setState((prev) => ({ ...prev, purchasing: true, error: null }));

      const userId = getCurrentUserId();

      await iapRequestPurchase({
        request: {
          apple: {
            sku,
            ...(userId ? { appAccountToken: userId } : {}),
          },
          google: {
            skus: [sku],
            ...(userId ? { obfuscatedAccountIdAndroid: userId } : {}),
          },
        },
        type: "in-app",
      });
    } catch (error) {
      logger.error("[IAP] Request purchase failed:", error);
      setState((prev) => ({ ...prev, purchasing: false }));
    }
  };

  const requestSubscription = async (sku: string, planType?: PlanType) => {
    try {
      setState((prev) => ({ ...prev, purchasing: true, error: null }));

      const userId = getCurrentUserId();

      if (Platform.OS === "android") {
        // Novo modelo Android: 1 subscription com base plans
        const subscription = state.subscriptions.find(
          (item) =>
            item.id === ANDROID_SUBSCRIPTION_PRODUCT_ID ||
            (item as any).productId === ANDROID_SUBSCRIPTION_PRODUCT_ID
        );

        const basePlanId = planType ? ANDROID_BASE_PLAN_MAP[planType] : null;

        // Tenta primeiro pelo basePlanId, fallback para legacy
        const offerToken = basePlanId
          ? getOfferTokenByBasePlan(subscription, basePlanId)
          : getAndroidSubscriptionOfferToken(subscription);

        if (!offerToken) {
          logger.error("[IAP] Missing Android offer token", {
            sku,
            planType,
            basePlanId,
          });
          setState((prev) => ({
            ...prev,
            purchasing: false,
            error: t("errors.generic"),
          }));
          return;
        }

        logger.log("[IAP] Android subscription purchase:", {
          productId: ANDROID_SUBSCRIPTION_PRODUCT_ID,
          basePlanId,
          offerToken: offerToken.substring(0, 20) + "...",
        });

        await iapRequestPurchase({
          request: {
            google: {
              skus: [ANDROID_SUBSCRIPTION_PRODUCT_ID],
              subscriptionOffers: [
                {
                  sku: ANDROID_SUBSCRIPTION_PRODUCT_ID,
                  offerToken,
                },
              ],
              ...(userId ? { obfuscatedAccountIdAndroid: userId } : {}),
            },
          },
          type: "subs",
        });
      } else {
        // iOS: continua usando SKUs separados
        await iapRequestPurchase({
          request: {
            apple: {
              sku,
              ...(userId ? { appAccountToken: userId } : {}),
            },
          },
          type: "subs",
        });
      }
    } catch (error) {
      logger.error("[IAP] Request subscription failed:", error);
      setState((prev) => ({ ...prev, purchasing: false }));
    }
  };

  const restorePurchases = async () => {
    try {
      setState((prev) => ({ ...prev, purchasing: true, error: null }));
      logger.log("[IAP] Restoring purchases...");

      const purchases = await getAvailablePurchases();

      for (const purchase of purchases) {
        const isConsumable = CONSUMABLE_SKUS.includes(purchase.productId);

        if (!isConsumable) {
          const entitlements = await validateReceiptWithBackend(
            purchase,
            false
          );
          if (entitlements) {
            handlePurchaseSuccess(entitlements);
          }
        }
      }

      setState((prev) => ({ ...prev, purchasing: false }));
    } catch (error) {
      logger.error("[IAP] Restore failed:", error);
      setState((prev) => ({
        ...prev,
        purchasing: false,
        error: "Restore failed",
      }));
    }
  };

  const refreshProducts = async () => {
    setState((prev) => ({ ...prev, loading: true }));
    await fetchStoreItems();
  };

  const value: IAPContextValue = {
    ...state,
    requestPurchase,
    requestSubscription,
    restorePurchases,
    refreshProducts,
  };

  return <IAPContext.Provider value={value}>{children}</IAPContext.Provider>;
}
