import type { SwipeAction } from "@/modules/database/models/SwipeQueue";
import type { Database } from "@nozbe/watermelondb";
import { interactUsersBatch } from "@/modules/interactions/api";
import * as swipeQueueService from "@/modules/discovery/swipe-queue-service";
import { removeDiscoveryProfiles } from "@/modules/discovery/discovery-service";
import { logger } from "@/utils/logger";

jest.mock("@/modules/interactions/api");
jest.mock("@/modules/discovery/discovery-service");
jest.mock("@/utils/logger");

describe("swipe-queue-service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("enqueueSwipe", () => {
    it("creates a new swipe when none exists", async () => {
      const prepareCreate = jest.fn((callback) => {
        const record: any = {};
        callback(record);
        return { type: "create", record };
      });
      const collection = {
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue([]),
        }),
        prepareCreate,
      };
      const discoveryCollection = {
        find: jest.fn().mockRejectedValue(new Error("missing")),
      };
      const database = {
        collections: {
          get: jest.fn((name: string) => {
            if (name === "swipes_queue") return collection;
            if (name === "discovery_profiles") return discoveryCollection;
            throw new Error(`Unknown collection: ${name}`);
          }),
        },
        write: jest.fn((callback) => callback()),
        batch: jest.fn(),
      };

      await swipeQueueService.enqueueSwipe({
        database: database as unknown as Database,
        targetUserId: "user-1",
        action: "like",
        placeId: "place-1",
      });

      expect(prepareCreate).toHaveBeenCalled();
      expect(database.batch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "create",
          record: expect.objectContaining({
            targetUserId: "user-1",
            action: "like",
            placeId: "place-1",
          }),
        })
      );
    });

    it("updates an existing swipe and removes the discovery profile", async () => {
      const prepareUpdate = jest.fn((callback) => {
        const record: any = {};
        callback(record);
        return { type: "update", record };
      });
      const existingRecord = { prepareUpdate };
      const collection = {
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue([existingRecord]),
        }),
      };
      const prepareDestroyPermanently = jest
        .fn()
        .mockReturnValue({ type: "delete" });
      const discoveryCollection = {
        find: jest.fn().mockResolvedValue({
          prepareDestroyPermanently,
        }),
      };
      const database = {
        collections: {
          get: jest.fn((name: string) => {
            if (name === "swipes_queue") return collection;
            if (name === "discovery_profiles") return discoveryCollection;
            throw new Error(`Unknown collection: ${name}`);
          }),
        },
        write: jest.fn((callback) => callback()),
        batch: jest.fn(),
      };

      await swipeQueueService.enqueueSwipe({
        database: database as unknown as Database,
        targetUserId: "user-2",
        action: "dislike",
        placeId: "place-2",
        removeProfileId: "user-2",
      });

      expect(prepareUpdate).toHaveBeenCalled();
      expect(prepareDestroyPermanently).toHaveBeenCalled();
      expect(database.batch).toHaveBeenCalledWith(
        expect.objectContaining({ type: "update" }),
        expect.objectContaining({ type: "delete" })
      );
    });
  });

  describe("flushQueuedSwipes", () => {
    it("removes successfully sent swipes and discovery profiles", async () => {
      const queuedRecords = [
        {
          id: "1",
          targetUserId: "user-1",
          action: "like" as SwipeAction,
          placeId: "place-1",
          createdAt: new Date(),
        },
        {
          id: "2",
          targetUserId: "user-2",
          action: "dislike" as SwipeAction,
          placeId: "place-1",
          createdAt: new Date(),
        },
      ];
      const deleteRecords = [
        {
          prepareDestroyPermanently: jest
            .fn()
            .mockReturnValue({ type: "delete", id: "user-1" }),
        },
      ];
      const collection = {
        query: jest
          .fn()
          .mockImplementationOnce(() => ({
            fetch: jest.fn().mockResolvedValue(queuedRecords),
          }))
          .mockImplementationOnce(() => ({
            fetch: jest.fn().mockResolvedValue(deleteRecords),
          })),
      };
      const database = {
        collections: {
          get: jest.fn(() => collection),
        },
        write: jest.fn((callback) => callback()),
        batch: jest.fn(),
      };

      (interactUsersBatch as jest.Mock).mockResolvedValue([
        { target_user_id: "user-1", action: "like", status: "ok" },
        { target_user_id: "user-2", action: "dislike", status: "error" },
      ]);

      const result = await swipeQueueService.flushQueuedSwipes({
        database: database as unknown as Database,
      });

      expect(interactUsersBatch).toHaveBeenCalledWith({
        batch: [
          { to_user_id: "user-1", action: "like", place_id: "place-1" },
          { to_user_id: "user-2", action: "dislike", place_id: "place-1" },
        ],
      });
      expect(database.batch).toHaveBeenCalledWith(
        expect.objectContaining({ type: "delete", id: "user-1" })
      );
      expect(removeDiscoveryProfiles).toHaveBeenCalledWith({
        database: database as unknown as Database,
        userIds: ["user-1"],
      });
      expect(result).toHaveLength(2);
    });

    it("logs and rethrows when the batch fails", async () => {
      const collection = {
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue([
            {
              id: "1",
              targetUserId: "user-1",
              action: "like",
              placeId: "place-1",
              createdAt: new Date(),
            },
          ]),
        }),
      };
      const database = {
        collections: {
          get: jest.fn(() => collection),
        },
        write: jest.fn((callback) => callback()),
        batch: jest.fn(),
      };

      (interactUsersBatch as jest.Mock).mockRejectedValue(
        new Error("network error")
      );

      await expect(
        swipeQueueService.flushQueuedSwipes({
          database: database as unknown as Database,
        })
      ).rejects.toThrow("network error");
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
