/**
 * Extrai o valor de preço de uma subscription
 */
export function getPriceValue(subscription: any): number | null {
  if (!subscription) return null;

  // If we have micros (most reliable)
  if (subscription.priceAmountMicros) {
    return parseFloat(subscription.priceAmountMicros) / 1000000;
  }

  // If price is already a number (android/debug sometimes)
  if (typeof subscription.price === "number") {
    return subscription.price;
  }

  // Try to parse string price (remove non-numeric except dot/comma)
  // This is a fallback and might be flaky with some currencies
  if (typeof subscription.price === "string") {
    // Remove currency symbols and non-breaking spaces
    const clean = subscription.price
      .replace(/[^0-9.,]/g, "")
      .replace(",", ".");
    const val = parseFloat(clean);
    return isNaN(val) ? null : val;
  }

  return null;
}

/**
 * Obtém o offerToken padrão de uma subscription Android (legacy)
 */
export function getAndroidSubscriptionOfferToken(
  subscription: any
): string | null {
  if (!subscription) return null;

  const offerDetails =
    subscription.subscriptionOfferDetailsAndroid ||
    subscription.subscriptionOfferDetails;

  if (!Array.isArray(offerDetails) || offerDetails.length === 0) {
    return null;
  }

  const basePlanOffer = offerDetails.find(
    (offer: any) => offer && !offer.offerId && offer.offerToken
  );

  if (basePlanOffer?.offerToken) {
    return basePlanOffer.offerToken;
  }

  const firstOffer = offerDetails.find(
    (offer: any) => offer && offer.offerToken
  );

  return firstOffer?.offerToken ?? null;
}

/**
 * Encontra o offerToken para um basePlanId específico
 * Usado no novo modelo Android com 1 subscription + múltiplos base plans
 */
export function getOfferTokenByBasePlan(
  subscription: any,
  basePlanId: string
): string | null {
  if (!subscription) return null;

  const offerDetails =
    subscription.subscriptionOfferDetailsAndroid ||
    subscription.subscriptionOfferDetails;

  if (!Array.isArray(offerDetails) || offerDetails.length === 0) {
    return null;
  }

  // Procura o base plan específico (sem offerId = base plan puro)
  const basePlanOffer = offerDetails.find(
    (offer: any) =>
      offer &&
      offer.basePlanId === basePlanId &&
      !offer.offerId &&
      offer.offerToken
  );

  if (basePlanOffer?.offerToken) {
    return basePlanOffer.offerToken;
  }

  // Fallback: qualquer offer com esse basePlanId
  const anyOffer = offerDetails.find(
    (offer: any) =>
      offer && offer.basePlanId === basePlanId && offer.offerToken
  );

  return anyOffer?.offerToken ?? null;
}

/**
 * Extrai informações de preço para um basePlanId específico
 */
export function getPriceForBasePlan(
  subscription: any,
  basePlanId: string
): { formattedPrice: string; priceAmountMicros: number } | null {
  if (!subscription) return null;

  const offerDetails =
    subscription.subscriptionOfferDetailsAndroid ||
    subscription.subscriptionOfferDetails;

  if (!Array.isArray(offerDetails)) return null;

  const offer = offerDetails.find(
    (o: any) => o && o.basePlanId === basePlanId
  );

  if (!offer?.pricingPhases?.pricingPhaseList?.[0]) return null;

  const phase = offer.pricingPhases.pricingPhaseList[0];
  return {
    formattedPrice: phase.formattedPrice || "",
    priceAmountMicros: parseInt(phase.priceAmountMicros || "0", 10),
  };
}
