import type { Database } from "@nozbe/watermelondb";
import type { ActiveUserAtPlace } from "@/modules/presence/api";
jest.mock("@/modules/presence/api", () => ({
  getActiveUsersAtPlace: jest.fn(),
}));
jest.mock("@/modules/discovery/liker-ids-service");
jest.mock("@/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("fetchDiscoveryFeed", () => {
  let discoveryService: typeof import("@/modules/discovery/discovery-service");
  let getActiveUsersAtPlace: jest.Mock;
  let logger: { error: jest.Mock };
  const placeId = "place-123";

  const createDatabase = (queuedTargets: string[] = []) => {
    const swipeQueueCollection = {
      query: jest.fn().mockReturnValue({
        fetch: jest.fn().mockResolvedValue(
          queuedTargets.map((targetUserId) => ({ targetUserId }))
        ),
      }),
    };

    const discoveryCollection = {
      query: jest.fn().mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      }),
    };

    return {
      collections: {
        get: jest.fn((name: string) => {
          if (name === "swipes_queue") return swipeQueueCollection;
          if (name === "discovery_profiles") return discoveryCollection;
          throw new Error(`Unknown collection: ${name}`);
        }),
      },
      write: jest.fn((callback) => callback()),
      batch: jest.fn(),
    };
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    discoveryService = require("@/modules/discovery/discovery-service");
    ({ getActiveUsersAtPlace } = jest.requireMock(
      "@/modules/presence/api"
    ) as {
      getActiveUsersAtPlace: jest.Mock;
    });
    ({ logger } = jest.requireMock("@/utils/logger") as {
      logger: { error: jest.Mock };
    });
  });

  it("upserts discovery profiles for existing and new users", async () => {
    const users: ActiveUserAtPlace[] = [
      { user_id: "user-1" } as ActiveUserAtPlace,
      { user_id: "user-2" } as ActiveUserAtPlace,
    ];
    const prepareUpdate = jest.fn((callback) => {
      const record: any = {};
      callback(record);
      return { type: "update", record };
    });
    const prepareCreate = jest.fn((callback) => {
      const record: any = { _raw: {} };
      callback(record);
      return { type: "create", record };
    });
    const collection = {
      find: jest
        .fn()
        .mockResolvedValueOnce({ prepareUpdate })
        .mockRejectedValueOnce(new Error("missing")),
      prepareCreate,
    };
    const database = {
      collections: {
        get: jest.fn(() => collection),
      },
      write: jest.fn((callback) => callback()),
      batch: jest.fn(),
    };

    await discoveryService.upsertDiscoveryProfiles({
      database: database as unknown as Database,
      placeId,
      users,
    });

    expect(prepareUpdate).toHaveBeenCalled();
    expect(prepareCreate).toHaveBeenCalled();
    expect(database.batch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "update" }),
      expect.objectContaining({
        type: "create",
        record: expect.objectContaining({
          _raw: { id: "user-2" },
        }),
      })
    );
  });

  it("returns an empty list and logs errors when the API fails", async () => {
    const database = createDatabase();
    (getActiveUsersAtPlace as jest.Mock).mockRejectedValue(
      new Error("API error")
    );

    const result = await discoveryService.fetchDiscoveryFeed({
      database: database as unknown as Database,
      placeId,
    });

    expect(result).toEqual([]);
    expect(logger.error).toHaveBeenCalled();
  });
});
