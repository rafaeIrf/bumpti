import { getEffectiveSortBy } from "@/modules/places/nearby-sort";

describe("nearby-sort", () => {
  test("forces distance when nearby mode is enabled", () => {
    expect(getEffectiveSortBy(true, "relevance")).toBe("distance");
  });

  test("preserves sortBy when nearby mode is disabled", () => {
    expect(getEffectiveSortBy(false, "rating")).toBe("rating");
  });
});
