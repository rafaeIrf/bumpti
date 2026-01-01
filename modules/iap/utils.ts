
export function getPriceValue(subscription: any): number | null {
  if (!subscription) return null;
  
  // If we have micros (most reliable)
  if (subscription.priceAmountMicros) {
    return parseFloat(subscription.priceAmountMicros) / 1000000;
  }
  
  // If price is already a number (android/debug sometimes)
  if (typeof subscription.price === 'number') {
    return subscription.price;
  }

  // Try to parse string price (remove non-numeric except dot/comma)
  // This is a fallback and might be flaky with some currencies
  if (typeof subscription.price === 'string') {
    // Remove currency symbols and non-breaking spaces
    const clean = subscription.price.replace(/[^0-9.,]/g, '').replace(',', '.');
    const val = parseFloat(clean);
    return isNaN(val) ? null : val;
  }

  return null;
}
