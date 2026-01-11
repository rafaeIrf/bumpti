import { filterDiscoveryProfiles } from "@/modules/discovery/utils";

describe("filterDiscoveryProfiles", () => {
  it("removes swiped, matched, and chatted profiles", () => {
    const profiles = [
      { user_id: "a" },
      { user_id: "b" },
      { user_id: "c" },
      { user_id: "d" },
    ] as any;

    const result = filterDiscoveryProfiles({
      profiles,
      swipedIds: ["b"],
      matchedIds: ["c"],
      chattedIds: ["d"],
    });

    expect(result.map((p: any) => p.user_id)).toEqual(["a"]);
  });

  it("ignores profiles without user_id", () => {
    const profiles = [{ user_id: "a" }, { user_id: "" }, {}] as any;

    const result = filterDiscoveryProfiles({
      profiles,
      swipedIds: [],
      matchedIds: [],
      chattedIds: [],
    });

    expect(result.map((p: any) => p.user_id)).toEqual(["a"]);
  });
});
