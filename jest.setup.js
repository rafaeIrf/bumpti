global.__DEV__ = true;

// Mock WatermelonDB decorators to prevent initialization errors in tests
jest.mock("@nozbe/watermelondb/decorators/lazy", () => ({
  __esModule: true,
  default: () => (target, key, descriptor) => {
    // Return a simple decorator that doesn't try to access properties during class definition
    return descriptor || {};
  },
}));

jest.mock("@nozbe/watermelondb/adapters/sqlite", () => ({
  __esModule: true,
  default: function MockSQLiteAdapter() {},
}));

jest.mock("expo-crypto", () => ({
  __esModule: true,
  getRandomBytesAsync: async (size) => new Uint8Array(size).fill(1),
}));

jest.mock("react-native-keychain", () => ({
  __esModule: true,
  ACCESSIBLE: {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: "WHEN_UNLOCKED_THIS_DEVICE_ONLY",
  },
  getGenericPassword: async () => null,
  setGenericPassword: async () => true,
  resetGenericPassword: async () => true,
}));

jest.mock("react-native-url-polyfill/auto", () => ({}));

process.env.EXPO_PUBLIC_SUPABASE_URL = "http://localhost:54321";
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

jest.mock("expo-image", () => ({
  __esModule: true,
  Image: {
    prefetch: async () => true,
  },
}));

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
