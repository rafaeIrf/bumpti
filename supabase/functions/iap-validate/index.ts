import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { requireAuth } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  CONSUMABLE_CREDITS,
  getEntitlements,
  getWelcomeCredits,
  grantCheckinCredits,
  isSubscriptionProduct,
  resolvePlanType,
  validateAppleReceipt,
  validateGooglePurchase,
} from "../_shared/iap-validation.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Auth & Supabase Setup
    const { user } = await requireAuth(req);
    const userId = user.id;

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Parse Request
    const { platform, purchase, isConsumable: isConsumableRequest } = await req.json();
    if (!purchase) throw new Error("Missing purchase data");

    let validatedData: any = null;

    // 3. Validation
    if (platform === "ios") {
      validatedData = await validateAppleReceipt(purchase, userId);
    } else if (platform === "android") {
      validatedData = await validateGooglePurchase(purchase, userId, isConsumableRequest);
    } else {
      throw new Error("Invalid platform");
    }

    if (!validatedData) throw new Error("Validation failed");

    const {
      sku,
      basePlanId, // Android only: e.g. "premium-monthly"
      storeTransactionId,
      originalTransactionId,
      purchaseDate,
      expiresDate,
      autoRenew,
      appUserToken,
    } = validatedData;

    // For Android, use basePlanId for plan identification; for iOS, use sku
    const planIdentifier = basePlanId || sku;

    console.log("[IAP Validate] Received:", {
      platform,
      sku,
      basePlanId,
      planIdentifier,
      storeTransactionId,
    });

    // 4. Idempotency Check - by exact transaction ID
    // Each billing event (renewal, initial purchase) has a unique transactionId
    const { data: existingPurchase } = await supabase
      .from("store_purchases")
      .select("id")
      .eq("store_transaction_id", storeTransactionId)
      .maybeSingle();

    if (existingPurchase) {
      console.log(`[Idempotency] Transaction ${storeTransactionId} already processed.`);
      return new Response(
        JSON.stringify({
          success: true,
          entitlements: await getEntitlements(supabase, userId),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Record Purchase
    // Android uses upsert to handle plan upgrades/downgrades with same transaction ID
    // iOS uses insert for strict idempotency
    const storeName = platform === "ios" ? "apple" : "google";

    const purchaseData = {
      user_id: userId,
      store: storeName,
      sku: sku,
      store_transaction_id: storeTransactionId,
      app_user_token: appUserToken,
      raw_receipt: purchase,
    };

    const { error: insertError } = platform === "android"
      ? await supabase.from("store_purchases").upsert(purchaseData, { onConflict: "store,store_transaction_id" })
      : await supabase.from("store_purchases").insert(purchaseData);

    if (insertError) throw new Error(`Failed to record: ${insertError.message}`);

    // 6. Apply Logic
    const isSubscription = isSubscriptionProduct(planIdentifier);
    const isConsumable = !!CONSUMABLE_CREDITS[sku];

    console.log("[IAP Validate] Product type check:", {
      planIdentifier,
      isSubscription,
      isConsumable,
    });

    if (isSubscription) {
      const { data: existingSub, error: subQueryError } = await supabase
        .from("user_subscriptions")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

      console.log("[IAP Validate] existingSub query result:", {
        userId,
        data: existingSub,
        error: subQueryError?.message,
      });

      const planName = resolvePlanType(planIdentifier);
      const isNewUser = !existingSub;

      console.log("[IAP Validate] Subscription check:", {
        userId,
        existingSub: !!existingSub,
        isNewUser,
        planName,
      });

      const { error: subError } = await supabase.from("user_subscriptions").upsert({
        user_id: userId,
        status: "active",
        plan: planName,
        started_at: purchaseDate?.toISOString(),
        expires_at: expiresDate?.toISOString(),
        auto_renew: !!autoRenew,
        original_transaction_id: originalTransactionId,
        store: storeName,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      if (subError) throw new Error(`Sub update failed: ${subError.message}`);

      // Only grant credits if this is the user's first subscription ever (welcome gift)
      const creditsToGrant = getWelcomeCredits(planIdentifier);
      if (isNewUser && creditsToGrant > 0) {
        await grantCheckinCredits(
          supabase,
          userId,
          creditsToGrant,
          `premium_bonus_${planName}`
        );
      }

    } else if (isConsumable) {
      const amount = CONSUMABLE_CREDITS[sku];
      await grantCheckinCredits(supabase, userId, amount, "iap_consumable");
    }

    // 7. Return Result
    return new Response(
      JSON.stringify({
        success: true,
        entitlements: await getEntitlements(supabase, userId),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error(`[IAP Error] ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
