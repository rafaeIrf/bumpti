import { decrementActiveUsersInCaches } from "@/modules/places/cache-utils";
import { placesApi } from "@/modules/places/placesApi";

// Mock the placesApi
jest.mock("@/modules/places/placesApi", () => ({
  placesApi: {
    util: {
      updateQueryData: jest.fn(),
    },
  },
}));

// Mock logger
jest.mock("@/utils/logger", () => ({
  logger: {
    log: jest.fn(),
  },
}));

describe("decrementActiveUsersInCaches", () => {
  const mockUserId = "user-123";
  const mockDispatch = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Global user removal from all places", () => {
    it("should remove user from all places in getNearbyPlaces cache (array type)", () => {
      const mockState = {
        placesApi: {
          queries: {
            "getNearbyPlaces-{\"lat\":-25.404,\"lng\":-49.246}": {
              data: [
                {
                  placeId: "place-1",
                  active_users: 5,
                  preview_avatars: [
                    { user_id: "user-123", avatar_url: "url1" },
                    { user_id: "user-456", avatar_url: "url2" },
                  ],
                },
                {
                  placeId: "place-2",
                  active_users: 3,
                  preview_avatars: [
                    { user_id: "user-789", avatar_url: "url3" },
                  ],
                },
              ],
              originalArgs: { latitude: -25.404, longitude: -49.246, category: [] },
            },
          },
        },
      };

      const mockGetState = jest.fn().mockReturnValue(mockState);

      decrementActiveUsersInCaches({
        dispatch: mockDispatch,
        getState: mockGetState,
        userId: mockUserId,
      });

      // updateQueryData should be called for getNearbyPlaces
      expect(placesApi.util.updateQueryData).toHaveBeenCalledWith(
        "getNearbyPlaces",
        expect.any(Object),
        expect.any(Function)
      );
    });

    it("should remove user from all places in getTrendingPlaces cache (nested type)", () => {
      const mockState = {
        placesApi: {
          queries: {
            "getTrendingPlaces--25.404--49.246": {
              data: {
                places: [
                  {
                    placeId: "place-1",
                    active_users: 10,
                    preview_avatars: [
                      { user_id: "user-123", avatar_url: "url1" },
                      { user_id: "user-456", avatar_url: "url2" },
                    ],
                  },
                ],
              },
              originalArgs: { lat: -25.404, lng: -49.246 },
            },
          },
        },
      };

      const mockGetState = jest.fn().mockReturnValue(mockState);

      decrementActiveUsersInCaches({
        dispatch: mockDispatch,
        getState: mockGetState,
        userId: mockUserId,
      });

      expect(placesApi.util.updateQueryData).toHaveBeenCalledWith(
        "getTrendingPlaces",
        expect.any(Object),
        expect.any(Function)
      );
    });

    it("should remove user from multiple cache types simultaneously", () => {
      const mockState = {
        placesApi: {
          queries: {
            "getNearbyPlaces-{...}": {
              data: [
                {
                  placeId: "place-1",
                  active_users: 5,
                  preview_avatars: [{ user_id: "user-123", avatar_url: "url1" }],
                },
              ],
              originalArgs: {},
            },
            "getTrendingPlaces--25.404--49.246": {
              data: {
                places: [
                  {
                    placeId: "place-2",
                    active_users: 8,
                    preview_avatars: [{ user_id: "user-123", avatar_url: "url2" }],
                  },
                ],
              },
              originalArgs: {},
            },
            "getFavoritePlaces({...})": {
              data: {
                places: [
                  {
                    placeId: "place-3",
                    active_users: 3,
                    preview_avatars: [{ user_id: "user-123", avatar_url: "url3" }],
                  },
                ],
              },
              originalArgs: {},
            },
          },
        },
      };

      const mockGetState = jest.fn().mockReturnValue(mockState);

      decrementActiveUsersInCaches({
        dispatch: mockDispatch,
        getState: mockGetState,
        userId: mockUserId,
      });

      // Should call updateQueryData for all three cache types
      expect(placesApi.util.updateQueryData).toHaveBeenCalledTimes(3);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty cache gracefully", () => {
      const mockState = {
        placesApi: {
          queries: {},
        },
      };

      const mockGetState = jest.fn().mockReturnValue(mockState);

      expect(() => {
        decrementActiveUsersInCaches({
          dispatch: mockDispatch,
          getState: mockGetState,
          userId: mockUserId,
        });
      }).not.toThrow();

      expect(placesApi.util.updateQueryData).not.toHaveBeenCalled();
    });

    it("should skip cache entries without data", () => {
      const mockState = {
        placesApi: {
          queries: {
            "getNearbyPlaces-{...}": {
              data: null, // No data
              originalArgs: {},
            },
          },
        },
      };

      const mockGetState = jest.fn().mockReturnValue(mockState);

      decrementActiveUsersInCaches({
        dispatch: mockDispatch,
        getState: mockGetState,
        userId: mockUserId,
      });

      expect(placesApi.util.updateQueryData).not.toHaveBeenCalled();
    });

    it("should skip cache entries without originalArgs", () => {
      const mockState = {
        placesApi: {
          queries: {
            "getNearbyPlaces-{...}": {
              data: [],
              originalArgs: null, // No args
            },
          },
        },
      };

      const mockGetState = jest.fn().mockReturnValue(mockState);

      decrementActiveUsersInCaches({
        dispatch: mockDispatch,
        getState: mockGetState,
        userId: mockUserId,
      });

      expect(placesApi.util.updateQueryData).not.toHaveBeenCalled();
    });

    it("should ignore unknown cache types", () => {
      const mockState = {
        placesApi: {
          queries: {
            "unknownEndpoint-123": {
              data: [{ placeId: "place-1" }],
              originalArgs: {},
            },
          },
        },
      };

      const mockGetState = jest.fn().mockReturnValue(mockState);

      decrementActiveUsersInCaches({
        dispatch: mockDispatch,
        getState: mockGetState,
        userId: mockUserId,
      });

      expect(placesApi.util.updateQueryData).not.toHaveBeenCalled();
    });

    it("should handle cache update errors gracefully", () => {
      const mockState = {
        placesApi: {
          queries: {
            "getNearbyPlaces-{...}": {
              data: [{ placeId: "place-1" }],
              originalArgs: {},
            },
          },
        },
      };

      const mockGetState = jest.fn().mockReturnValue(mockState);
      (placesApi.util.updateQueryData as jest.Mock).mockImplementation(() => {
        throw new Error("Cache update failed");
      });

      // Should not throw error
      expect(() => {
        decrementActiveUsersInCaches({
          dispatch: mockDispatch,
          getState: mockGetState,
          userId: mockUserId,
        });
      }).not.toThrow();
    });
  });

  describe("All supported cache types", () => {
    const cacheTypes = [
      { key: "getNearbyPlaces-{...}", endpoint: "getNearbyPlaces", isNested: false },
      { key: "getTrendingPlaces--25.404--49.246", endpoint: "getTrendingPlaces", isNested: true },
      { key: "getFavoritePlaces({...})", endpoint: "getFavoritePlaces", isNested: true },
      { key: "getRankedPlaces({...})", endpoint: "getRankedPlaces", isNested: false },
      { key: "searchPlacesByText({...})", endpoint: "searchPlacesByText", isNested: true },
      { key: "getPlacesByFavorites({...})", endpoint: "getPlacesByFavorites", isNested: false },
    ];

    cacheTypes.forEach(({ key, endpoint, isNested }) => {
      it(`should handle ${endpoint} cache correctly`, () => {
        const places = [
          {
            placeId: "place-1",
            active_users: 5,
            preview_avatars: [{ user_id: "user-123", avatar_url: "url1" }],
          },
        ];

        const data = isNested ? { places } : places;

        const mockState = {
          placesApi: {
            queries: {
              [key]: {
                data,
                originalArgs: {},
              },
            },
          },
        };

        const mockGetState = jest.fn().mockReturnValue(mockState);

        decrementActiveUsersInCaches({
          dispatch: mockDispatch,
          getState: mockGetState,
          userId: mockUserId,
        });

        expect(placesApi.util.updateQueryData).toHaveBeenCalledWith(
          endpoint,
          expect.any(Object),
          expect.any(Function)
        );
      });
    });
  });

  describe("Empty place filtering", () => {
    it("should filter out places with zero active_users from getTrendingPlaces", () => {
      const mockUpdateQueryData = jest.fn((endpoint, args, updateFn) => {
        // Simulate the actual updateQueryData behavior
        const draft = {
          places: [
            {
              placeId: "place-1",
              active_users: 1,
              preview_avatars: [{ user_id: "user-123", avatar_url: "url1" }],
            },
            {
              placeId: "place-2",
              active_users: 2,
              preview_avatars: [{ user_id: "user-456", avatar_url: "url2" }],
            },
          ],
        };
        updateFn(draft);
        return draft;
      });

      (placesApi.util.updateQueryData as jest.Mock) = mockUpdateQueryData;

      const mockState = {
        placesApi: {
          queries: {
            "getTrendingPlaces--25.404--49.246": {
              data: {
                places: [
                  {
                    placeId: "place-1",
                    active_users: 1,
                    preview_avatars: [{ user_id: "user-123", avatar_url: "url1" }],
                  },
                  {
                    placeId: "place-2",
                    active_users: 2,
                    preview_avatars: [{ user_id: "user-456", avatar_url: "url2" }],
                  },
                ],
              },
              originalArgs: { lat: -25.404, lng: -49.246 },
            },
          },
        },
      };

      const mockGetState = jest.fn().mockReturnValue(mockState);

      decrementActiveUsersInCaches({
        dispatch: mockDispatch,
        getState: mockGetState,
        userId: "user-123",
      });

      expect(mockUpdateQueryData).toHaveBeenCalledWith(
        "getTrendingPlaces",
        expect.any(Object),
        expect.any(Function)
      );

      // Get the draft that was modified
      const updateFn = mockUpdateQueryData.mock.calls[0][2];
      const draft = {
        places: [
          {
            placeId: "place-1",
            active_users: 1,
            preview_avatars: [{ user_id: "user-123", avatar_url: "url1" }],
          },
          {
            placeId: "place-2",
            active_users: 2,
            preview_avatars: [{ user_id: "user-456", avatar_url: "url2" }],
          },
        ],
      };

      updateFn(draft);

      // After removing user-123 from place-1, it should have 0 active_users and be filtered out
      // place-2 should still be there
      expect(draft.places).toHaveLength(1);
      expect(draft.places[0].placeId).toBe("place-2");
      expect(draft.places[0].active_users).toBe(2);
    });

    it("should NOT filter empty places from other cache types (e.g., getNearbyPlaces)", () => {
      const mockUpdateQueryData = jest.fn((endpoint, args, updateFn) => {
        const draft = [
          {
            placeId: "place-1",
            active_users: 1,
            preview_avatars: [{ user_id: "user-123", avatar_url: "url1" }],
          },
        ];
        updateFn(draft);
        return draft;
      });

      (placesApi.util.updateQueryData as jest.Mock) = mockUpdateQueryData;

      const mockState = {
        placesApi: {
          queries: {
            "getNearbyPlaces-{...}": {
              data: [
                {
                  placeId: "place-1",
                  active_users: 1,
                  preview_avatars: [{ user_id: "user-123", avatar_url: "url1" }],
                },
              ],
              originalArgs: {},
            },
          },
        },
      };

      const mockGetState = jest.fn().mockReturnValue(mockState);

      decrementActiveUsersInCaches({
        dispatch: mockDispatch,
        getState: mockGetState,
        userId: "user-123",
      });

      expect(mockUpdateQueryData).toHaveBeenCalledWith(
        "getNearbyPlaces",
        expect.any(Object),
        expect.any(Function)
      );

      // Get the draft that was modified
      const updateFn = mockUpdateQueryData.mock.calls[0][2];
      const draft = [
        {
          placeId: "place-1",
          active_users: 1,
          preview_avatars: [{ user_id: "user-123", avatar_url: "url1" }],
        },
      ];

      updateFn(draft);

      // Even though active_users becomes 0, getNearbyPlaces should NOT filter it out
      expect(draft).toHaveLength(1);
      expect(draft[0].placeId).toBe("place-1");
      expect(draft[0].active_users).toBe(0);
    });

    it("should keep places in getTrendingPlaces if they have regulars but zero active_users after removal", () => {
      const mockUpdateQueryData = jest.fn((endpoint, args, updateFn) => {
        const draft = {
          places: [
            {
              placeId: "place-1",
              active_users: 1,
              regulars_count: 1,
              preview_avatars: [{ user_id: "user-123", avatar_url: "url1" }],
            },
            {
              placeId: "place-2",
              active_users: 0,
              regulars_count: 0,
              preview_avatars: [],
            },
          ],
        };
        updateFn(draft);
        return draft;
      });

      (placesApi.util.updateQueryData as jest.Mock) = mockUpdateQueryData;

      const mockState = {
        placesApi: {
          queries: {
            "getTrendingPlaces--25.404--49.246": {
              data: {
                places: [
                  {
                    placeId: "place-1",
                    active_users: 1,
                    regulars_count: 1,
                    preview_avatars: [{ user_id: "user-123", avatar_url: "url1" }],
                  },
                  {
                    placeId: "place-2",
                    active_users: 0,
                    regulars_count: 0,
                    preview_avatars: [],
                  },
                ],
              },
              originalArgs: { lat: -25.404, lng: -49.246 },
            },
          },
        },
      };

      const mockGetState = jest.fn().mockReturnValue(mockState);

      decrementActiveUsersInCaches({
        dispatch: mockDispatch,
        getState: mockGetState,
        userId: "user-123",
      });

      const updateFn = mockUpdateQueryData.mock.calls[0][2];
      const draft = {
        places: [
          {
            placeId: "place-1",
            active_users: 1,
            regulars_count: 1,
            preview_avatars: [{ user_id: "user-123", avatar_url: "url1" }],
          },
          {
            placeId: "place-2",
            active_users: 0,
            regulars_count: 0,
            preview_avatars: [],
          },
        ],
      };

      updateFn(draft);

      // place-1 had active_users=1, now 0 after swipe, but regulars_count=1 so it stays
      // place-2 has active_users=0 and regulars_count=0, so it gets filtered out
      expect(draft.places).toHaveLength(1);
      expect(draft.places[0].placeId).toBe("place-1");
      expect(draft.places[0].active_users).toBe(0);
      expect(draft.places[0].regulars_count).toBe(1);
    });

    it("should keep places in getTrendingPlaces if they still have active users after removal", () => {
      const mockUpdateQueryData = jest.fn((endpoint, args, updateFn) => {
        const draft = {
          places: [
            {
              placeId: "place-1",
              active_users: 2,
              preview_avatars: [
                { user_id: "user-123", avatar_url: "url1" },
                { user_id: "user-456", avatar_url: "url2" },
              ],
            },
          ],
        };
        updateFn(draft);
        return draft;
      });

      (placesApi.util.updateQueryData as jest.Mock) = mockUpdateQueryData;

      const mockState = {
        placesApi: {
          queries: {
            "getTrendingPlaces--25.404--49.246": {
              data: {
                places: [
                  {
                    placeId: "place-1",
                    active_users: 2,
                    preview_avatars: [
                      { user_id: "user-123", avatar_url: "url1" },
                      { user_id: "user-456", avatar_url: "url2" },
                    ],
                  },
                ],
              },
              originalArgs: { lat: -25.404, lng: -49.246 },
            },
          },
        },
      };

      const mockGetState = jest.fn().mockReturnValue(mockState);

      decrementActiveUsersInCaches({
        dispatch: mockDispatch,
        getState: mockGetState,
        userId: "user-123",
      });

      const updateFn = mockUpdateQueryData.mock.calls[0][2];
      const draft = {
        places: [
          {
            placeId: "place-1",
            active_users: 2,
            preview_avatars: [
              { user_id: "user-123", avatar_url: "url1" },
              { user_id: "user-456", avatar_url: "url2" },
            ],
          },
        ],
      };

      updateFn(draft);

      // After removing user-123, place-1 should still have 1 active_user and remain in cache
      expect(draft.places).toHaveLength(1);
      expect(draft.places[0].placeId).toBe("place-1");
      expect(draft.places[0].active_users).toBe(1);
      expect(draft.places[0].preview_avatars).toHaveLength(1);
      expect(draft.places[0].preview_avatars[0].user_id).toBe("user-456");
    });
  });
});
