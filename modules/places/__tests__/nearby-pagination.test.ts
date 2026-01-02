import { shouldHaveMorePages } from "@/modules/places/nearby-pagination";

describe("nearby-pagination", () => {
  test("returns true when page 1 has a full page", () => {
    expect(
      shouldHaveMorePages({
        page: 1,
        pageSize: 20,
        totalLoaded: 20,
        maxPages: 3,
      })
    ).toBe(true);
  });

  test("returns false when page 1 is incomplete", () => {
    expect(
      shouldHaveMorePages({
        page: 1,
        pageSize: 20,
        totalLoaded: 12,
        maxPages: 3,
      })
    ).toBe(false);
  });

  test("returns true when page 2 has at least 2 full pages loaded", () => {
    expect(
      shouldHaveMorePages({
        page: 2,
        pageSize: 20,
        totalLoaded: 40,
        maxPages: 3,
      })
    ).toBe(true);
  });

  test("returns false when page 2 does not have enough items", () => {
    expect(
      shouldHaveMorePages({
        page: 2,
        pageSize: 20,
        totalLoaded: 35,
        maxPages: 3,
      })
    ).toBe(false);
  });

  test("returns false when page reaches maxPages", () => {
    expect(
      shouldHaveMorePages({
        page: 3,
        pageSize: 20,
        totalLoaded: 60,
        maxPages: 3,
      })
    ).toBe(false);
  });
});
