import {
  Product,
  PurchaseError,
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
import { CONSUMABLE_SKUS, SUBSCRIPTION_SKUS } from "./config";
import { IAPContextValue, IAPState } from "./types";
import { getAndroidSubscriptionOfferToken } from "./utils";

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

      // Note: flushFailedPurchasesCachedAsPendingAndroid is not strictly needed with modern finishTransaction
      // or might be auto-handled by initConnection in this wrapper version.

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

      // Note: fetchProducts returns Product[], we cast subscriptions if necessary
      // or expo-iap unified types. Subscription type usually extends Product.

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
        // 'purchase' type might vary, casting to any or generic Purchase structure
        const receipt = purchase.transactionReceipt;
        const token = purchase.purchaseToken; // Android
        console.log("[IAP] Purchase update received:", purchase);

        if (receipt || token) {
          try {
            // Determine if it's a consumable based on SKU
            const isConsumable = CONSUMABLE_SKUS.includes(purchase.productId);

            // Backend Validation
            const entitlements = await validateReceiptWithBackend(
              purchase,
              isConsumable
            );

            if (entitlements) {
              // finishTransaction consumes consumables if configured or platform dependent
              // For expo-iap/react-native-iap, passing isConsumable: true helps on Android?
              // Standard API: finishTransaction({ purchase, isConsumable })
              // Check typings: finishTransaction expects (purchase: Purchase, isConsumable?: boolean, developerPayloadAndroid?: string)

              await finishTransaction({ purchase, isConsumable });

              // Update Redux
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

    const purchaseErrorSubscription = purchaseErrorListener(
      (error: PurchaseError) => {
        logger.warn("[IAP] Purchase error:", error);
        setState((prev) => ({
          ...prev,
          purchasing: false,
          error: error.message,
        }));
      }
    );

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

      // Use standard requestPurchase with correct type
      // Assuming consumables are 'in-app'
      // Get current user ID for linking
      const userId = getCurrentUserId();
      // On iOS, appAccountToken must be a UUID. Supabase IDs are UUIDs.
      // On Android, use obfuscatedAccountIdAndroid.

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

  const requestSubscription = async (sku: string) => {
    try {
      setState((prev) => ({ ...prev, purchasing: true, error: null }));

      const subscription = state.subscriptions.find(
        (item) => item.id === sku || (item as any).productId === sku
      );

      const androidOfferToken =
        Platform.OS === "android"
          ? getAndroidSubscriptionOfferToken(subscription)
          : null;

      if (Platform.OS === "android" && !androidOfferToken) {
        logger.error(
          "[IAP] Missing Android subscription offer token for SKU:",
          sku
        );
        setState((prev) => ({
          ...prev,
          purchasing: false,
          error: t("errors.generic"),
        }));
        return;
      }

      // Get current user ID for linking
      const userId = getCurrentUserId();

      await iapRequestPurchase({
        request: {
          apple: {
            sku,
            ...(userId ? { appAccountToken: userId } : {}),
          },
          google: {
            skus: [sku],
            ...(androidOfferToken
              ? {
                  subscriptionOffers: [{ sku, offerToken: androidOfferToken }],
                }
              : {}),
            ...(userId ? { obfuscatedAccountIdAndroid: userId } : {}),
          },
        },
        type: "subs",
      });
    } catch (error) {
      logger.error("[IAP] Request subscription failed:", error);
      setState((prev) => ({ ...prev, purchasing: false }));
    }
  };

  const restorePurchases = async () => {
    try {
      setState((prev) => ({ ...prev, purchasing: true, error: null }));
      logger.log("[IAP] Restoring purchases...");

      // restorePurchases returns void in this version, it triggers updates via listener?
      // Or returns purchases? d.ts says "does not return the purchases; consumers should call getAvailablePurchases"

      await iapRequestPurchase({
        type: "restore", // This effectively triggers restore or use restorePurchases() fn
      } as any);
      // WAIT, restorePurchases is exported as a function.

      // Using the exported function
      // It says: "Only strictly supported for iOS... Android just uses getAvailablePurchases"
      if (Platform.OS === "ios") {
        // expo-iap restorePurchases might require password
        // Actually, expo-iap d.ts says restorePurchases is a MutationField.
        // @ts-ignore
        await RNIap.restorePurchases();
      }

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
