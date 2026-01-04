import { getAndroidSubscriptionOfferToken } from "@/modules/iap/utils";

describe("getAndroidSubscriptionOfferToken", () => {
  it("returns null when subscription is missing", () => {
    expect(getAndroidSubscriptionOfferToken(null)).toBeNull();
  });

  it("returns the base plan offer token when available", () => {
    const subscription = {
      subscriptionOfferDetailsAndroid: [
        { offerId: "intro", offerToken: "token-intro" },
        { offerToken: "token-base" },
      ],
    };

    expect(getAndroidSubscriptionOfferToken(subscription)).toBe("token-base");
  });

  it("falls back to the first offer token when no base plan token exists", () => {
    const subscription = {
      subscriptionOfferDetailsAndroid: [
        { offerId: "intro", offerToken: "token-intro" },
        { offerId: "trial", offerToken: "token-trial" },
      ],
    };

    expect(getAndroidSubscriptionOfferToken(subscription)).toBe("token-intro");
  });

  it("reads legacy offer details field when present", () => {
    const subscription = {
      subscriptionOfferDetails: [{ offerToken: "token-legacy" }],
    };

    expect(getAndroidSubscriptionOfferToken(subscription)).toBe("token-legacy");
  });
});
