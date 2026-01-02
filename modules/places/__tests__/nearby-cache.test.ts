import {
  buildNearbyCacheKey,
  mergeNearbyPlaces,
  shouldRefetchNearby,
} from "@/modules/places/nearby-cache";

const baseArgs = {
  latitude: 10.001,
  longitude: 20.001,
  category: ["bar", "cafe"],
  pageSize: 20,
  sortBy: "relevance" as const,
  minRating: null,
};

describe("nearby-cache", () => {
  test("buildNearbyCacheKey normalizes category order and coords", () => {
    const keyA = buildNearbyCacheKey(baseArgs);
    const keyB = buildNearbyCacheKey({
      ...baseArgs,
      category: ["cafe", "bar"],
      latitude: 10.0011,
      longitude: 20.0011,
    });

    expect(keyA).toBe(keyB);
  });

  test("mergeNearbyPlaces replaces on page 1", () => {
    const current = [{ placeId: "1" }, { placeId: "2" }] as any[];
    const incoming = [{ placeId: "3" }] as any[];
    const merged = mergeNearbyPlaces(current as any, incoming as any, 1);
    expect(merged).toEqual([{ placeId: "3" }, { placeId: "2" }]);
  });

  test("mergeNearbyPlaces preserves tail when page 1 refreshes", () => {
    const current = [
      { placeId: "1" },
      { placeId: "2" },
      { placeId: "3" },
    ] as any[];
    const incoming = [{ placeId: "4" }] as any[];
    const merged = mergeNearbyPlaces(current as any, incoming as any, 1);
    expect(merged.map((p) => p.placeId)).toEqual(["4", "2", "3"]);
  });

  test("mergeNearbyPlaces appends and dedupes on page > 1", () => {
    const current = [{ placeId: "1" }, { placeId: "2" }] as any[];
    const incoming = [{ placeId: "2" }, { placeId: "3" }] as any[];
    const merged = mergeNearbyPlaces(current as any, incoming as any, 2);
    expect(merged.map((p) => p.placeId)).toEqual(["1", "2", "3"]);
  });

  test("shouldRefetchNearby only refetches when page increases", () => {
    expect(
      shouldRefetchNearby(
        { ...baseArgs, page: 2 },
        { ...baseArgs, page: 1 }
      )
    ).toBe(true);
    expect(
      shouldRefetchNearby(
        { ...baseArgs, page: 1 },
        { ...baseArgs, page: 3 }
      )
    ).toBe(false);
    expect(shouldRefetchNearby(undefined, undefined)).toBe(false);
  });
});
