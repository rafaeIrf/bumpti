jest.mock("@react-native-community/netinfo", () => ({
  useNetInfo: jest.fn(),
}));

import { getPrefetchWindowSize } from "@/hooks/use-prefetch-window-size";

describe("getPrefetchWindowSize", () => {
  it("returns 3 on cellular connections", () => {
    expect(getPrefetchWindowSize("cellular")).toBe(3);
  });

  it("returns 6 on wifi or unknown connections", () => {
    expect(getPrefetchWindowSize("wifi")).toBe(6);
    expect(getPrefetchWindowSize(null)).toBe(6);
    expect(getPrefetchWindowSize(undefined)).toBe(6);
  });
});
