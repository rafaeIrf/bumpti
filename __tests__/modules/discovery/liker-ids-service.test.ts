import type { Database } from "@nozbe/watermelondb";
import * as likerIdsService from "@/modules/discovery/liker-ids-service";

describe("liker-ids-service", () => {
  const createDatabase = (collectionOverride?: any) => {
    const collection = collectionOverride ?? {
      find: jest.fn(),
      prepareCreate: jest.fn((callback: (record: any) => void) => {
        const record: any = { _raw: {} };
        callback(record);
        return { type: "create", record };
      }),
      query: jest.fn().mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      }),
    };

    const database = {
      collections: {
        get: jest.fn(() => collection),
      },
      write: jest.fn((callback) => callback()),
      batch: jest.fn(),
    };

    return { collection, database };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("upserts only missing ids", async () => {
    const { collection, database } = createDatabase();
    collection.find.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error());

    await likerIdsService.upsertLikerIds({
      database: database as unknown as Database,
      ids: ["existing-id", "new-id"],
    });

    expect(collection.prepareCreate).toHaveBeenCalledWith(
      expect.any(Function)
    );
    expect(database.batch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "create",
        record: expect.objectContaining({
          _raw: { id: "new-id" },
        }),
      })
    );
  });

  it("checks if a liker id exists", async () => {
    const { collection, database } = createDatabase();
    collection.find.mockResolvedValueOnce({});

    const exists = await likerIdsService.hasLikerId({
      database: database as unknown as Database,
      id: "user-1",
    });

    expect(exists).toBe(true);

    collection.find.mockRejectedValueOnce(new Error("missing"));
    const missing = await likerIdsService.hasLikerId({
      database: database as unknown as Database,
      id: "user-2",
    });
    expect(missing).toBe(false);
  });

  it("removes a liker id when present", async () => {
    const destroyPermanently = jest.fn().mockResolvedValue(undefined);
    const { database } = createDatabase({
      find: jest.fn().mockResolvedValue({ destroyPermanently }),
      query: jest.fn().mockReturnValue({ fetch: jest.fn() }),
    });

    await likerIdsService.removeLikerId({
      database: database as unknown as Database,
      id: "user-3",
    });

    expect(destroyPermanently).toHaveBeenCalled();
  });

  it("lists and clears liker ids", async () => {
    const records = [{ id: "a" }, { id: "b" }];
    const listSetup = createDatabase();
    listSetup.collection.query.mockReturnValueOnce({
      fetch: jest.fn().mockResolvedValue(records),
    });
    const list = await likerIdsService.listLikerIds({
      database: listSetup.database as unknown as Database,
    });
    expect(list).toEqual(["a", "b"]);

    const prepareDestroyPermanently = jest
      .fn()
      .mockReturnValue({ type: "delete" });
    const clearSetup = createDatabase();
    clearSetup.collection.query.mockReturnValueOnce({
      fetch: jest
        .fn()
        .mockResolvedValue(
          records.map(() => ({ prepareDestroyPermanently }))
        ),
    });

    await likerIdsService.clearLikerIds({
      database: clearSetup.database as unknown as Database,
    });

    expect(clearSetup.database.batch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "delete" }),
      expect.objectContaining({ type: "delete" })
    );
  });
});
