import { handleNewMatchBroadcast, handleNewMessageBroadcast } from "@/modules/database/realtime/handlers";
import type { Database } from "@nozbe/watermelondb";

// Mock dependencies
jest.mock("@/modules/database/sync", () => ({
  syncDatabase: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("@/utils/review", () => ({
  requestReviewAfterFirstMatch: jest.fn().mockResolvedValue(undefined),
}));

describe("handleNewMessageBroadcast", () => {
  const currentUserId = "current-user-id";
  const otherUserId = "other-user-id";
  const chatId = "chat-123";
  const matchId = "match-456";
  const messageId = "message-789";

  const createMockDatabase = (options: {
    messageExists?: boolean;
    chatExists?: boolean;
    chatLastMessageAt?: Date | null;
    matchExists?: boolean;
    matchFirstMessageAt?: Date | null;
  }) => {
    const {
      messageExists = false,
      chatExists = true,
      chatLastMessageAt = null,
      matchExists = true,
      matchFirstMessageAt = null,
    } = options;

    const messagePrepareCreate = jest.fn((callback) => {
      const record: any = { _raw: {} };
      callback(record);
      return { type: "create", record };
    });

    const chatPrepareUpdate = jest.fn((callback) => {
      const record: any = {};
      callback(record);
      return { type: "update", record };
    });

    const matchPrepareUpdate = jest.fn((callback) => {
      const record: any = {};
      callback(record);
      return { type: "update", record };
    });

    const mockChat = {
      id: chatId,
      matchId: matchId,
      lastMessageAt: chatLastMessageAt,
      prepareUpdate: chatPrepareUpdate,
    };

    const mockMatch = {
      id: matchId,
      firstMessageAt: matchFirstMessageAt,
      prepareUpdate: matchPrepareUpdate,
    };

    const messagesCollection = {
      query: jest.fn().mockReturnValue({
        fetch: jest.fn().mockResolvedValue(messageExists ? [{ id: messageId }] : []),
      }),
      prepareCreate: messagePrepareCreate,
    };

    const chatsCollection = {
      find: chatExists
        ? jest.fn().mockResolvedValue(mockChat)
        : jest.fn().mockRejectedValue(new Error("Chat not found")),
    };

    const matchesCollection = {
      find: matchExists
        ? jest.fn().mockResolvedValue(mockMatch)
        : jest.fn().mockRejectedValue(new Error("Match not found")),
    };

    const batchFn = jest.fn();

    const database = {
      collections: {
        get: jest.fn((name: string) => {
          if (name === "messages") return messagesCollection;
          if (name === "chats") return chatsCollection;
          if (name === "matches") return matchesCollection;
          throw new Error(`Unknown collection: ${name}`);
        }),
      },
      write: jest.fn((callback) => callback()),
      batch: batchFn,
    };

    return {
      database: database as unknown as Database,
      mocks: {
        messagePrepareCreate,
        chatPrepareUpdate,
        matchPrepareUpdate,
        batchFn,
        chatsCollection,
        matchesCollection,
      },
    };
  };

  const createPayload = (overrides = {}) => ({
    id: messageId,
    chat_id: chatId,
    sender_id: otherUserId,
    content: "Hello!",
    created_at: "2026-02-02T12:00:00Z",
    status: "sent",
    ...overrides,
  });

  it("should skip own messages", async () => {
    const { database, mocks } = createMockDatabase({});
    const payload = createPayload({ sender_id: currentUserId });

    await handleNewMessageBroadcast(payload, currentUserId, database);

    expect(mocks.batchFn).not.toHaveBeenCalled();
  });

  it("should insert new message and update chat with lastMessageContent", async () => {
    const { database, mocks } = createMockDatabase({
      messageExists: false,
      chatExists: true,
      chatLastMessageAt: null,
    });
    const payload = createPayload();

    await handleNewMessageBroadcast(payload, currentUserId, database);

    // Should prepare message creation
    expect(mocks.messagePrepareCreate).toHaveBeenCalled();
    
    // Should prepare chat update with lastMessageContent
    expect(mocks.chatPrepareUpdate).toHaveBeenCalled();
    const chatUpdateCallback = mocks.chatPrepareUpdate.mock.calls[0][0];
    const chatRecord: any = {};
    chatUpdateCallback(chatRecord);
    expect(chatRecord.lastMessageContent).toBe("Hello!");
    expect(chatRecord.lastMessageAt).toBeInstanceOf(Date);
  });

  it("should update match.firstMessageAt when it is the first message", async () => {
    const { database, mocks } = createMockDatabase({
      messageExists: false,
      chatExists: true,
      chatLastMessageAt: null, // First message
      matchExists: true,
      matchFirstMessageAt: null, // Match doesn't have first message yet
    });
    const payload = createPayload();

    await handleNewMessageBroadcast(payload, currentUserId, database);

    // Should prepare match update with firstMessageAt
    expect(mocks.matchPrepareUpdate).toHaveBeenCalled();
    const matchUpdateCallback = mocks.matchPrepareUpdate.mock.calls[0][0];
    const matchRecord: any = {};
    matchUpdateCallback(matchRecord);
    expect(matchRecord.firstMessageAt).toBeInstanceOf(Date);
  });

  it("should NOT update match.firstMessageAt when chat already has messages", async () => {
    const { database, mocks } = createMockDatabase({
      messageExists: false,
      chatExists: true,
      chatLastMessageAt: new Date("2026-01-01T12:00:00Z"), // Chat already has messages
      matchExists: true,
      matchFirstMessageAt: new Date("2026-01-01T12:00:00Z"),
    });
    const payload = createPayload();

    await handleNewMessageBroadcast(payload, currentUserId, database);

    // Should still update chat
    expect(mocks.chatPrepareUpdate).toHaveBeenCalled();
    
    // Should NOT update match (not first message)
    expect(mocks.matchPrepareUpdate).not.toHaveBeenCalled();
  });

  it("should execute all updates in a single batch", async () => {
    const { database, mocks } = createMockDatabase({
      messageExists: false,
      chatExists: true,
      chatLastMessageAt: null,
      matchExists: true,
      matchFirstMessageAt: null,
    });
    const payload = createPayload();

    await handleNewMessageBroadcast(payload, currentUserId, database);

    // Batch should be called with message, chat, and match updates
    expect(mocks.batchFn).toHaveBeenCalledTimes(1);
    const batchArgs = mocks.batchFn.mock.calls[0];
    expect(batchArgs.length).toBe(3); // message + chat + match
  });

  it("should skip message insertion if message already exists", async () => {
    const { database, mocks } = createMockDatabase({
      messageExists: true, // Message already exists
      chatExists: true,
      chatLastMessageAt: null,
    });
    const payload = createPayload();

    await handleNewMessageBroadcast(payload, currentUserId, database);

    // Should NOT prepare message creation
    expect(mocks.messagePrepareCreate).not.toHaveBeenCalled();
    
    // Should still update chat
    expect(mocks.chatPrepareUpdate).toHaveBeenCalled();
  });
});

describe("handleNewMatchBroadcast", () => {
  // Basic smoke test for match creation
  it("should create match and chat from broadcast", async () => {
    const matchId = "match-123";
    const chatId = "chat-456";
    
    const matchPrepareCreate = jest.fn((callback) => {
      const record: any = { _raw: {} };
      callback(record);
      return { type: "create", record };
    });

    const chatPrepareCreate = jest.fn((callback) => {
      const record: any = { _raw: {} };
      callback(record);
      return { type: "create", record };
    });

    const matchesCollection = {
      query: jest.fn().mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      }),
      create: matchPrepareCreate,
    };

    const chatsCollection = {
      query: jest.fn().mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      }),
      prepareCreate: chatPrepareCreate,
    };

    const batchFn = jest.fn();

    const database = {
      collections: {
        get: jest.fn((name: string) => {
          if (name === "matches") return matchesCollection;
          if (name === "chats") return chatsCollection;
          throw new Error(`Unknown collection: ${name}`);
        }),
      },
      write: jest.fn((callback) => callback()),
      batch: batchFn,
    };

    const payload = {
      id: matchId,
      chat_id: chatId,
      user_a: "user-a",
      user_b: "user-b",
      status: "active",
      matched_at: "2026-02-02T12:00:00Z",
      other_user_id: "user-b",
      other_user_name: "Test User",
    };

    await handleNewMatchBroadcast(payload, database as unknown as Database);

    // Match should be created
    expect(matchesCollection.create).toHaveBeenCalled();
  });
});
