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

// Mock analytics module to prevent Jest from parsing expo-constants
jest.mock("@/modules/analytics", () => ({
  AnalyticsProvider: ({ children }) => children,
  trackEvent: jest.fn(),
  identify: jest.fn(),
  reset: jest.fn(),
  trackLogin: jest.fn(),
  trackLogout: jest.fn(),
  trackAccountDeletion: jest.fn(),
  trackOnboardingComplete: jest.fn(),
  trackCheckin: jest.fn(),
  trackMatch: jest.fn(),
  getTrackingStatus: jest.fn(async () => "authorized"),
  isTrackingAllowed: jest.fn(async () => true),
  requestTrackingPermission: jest.fn(async () => "authorized"),
  ANALYTICS_EVENTS: {},
}));

// Mock expo-file-system to prevent native module errors in tests
jest.mock("expo-file-system", () => ({
  __esModule: true,
  downloadAsync: jest.fn(),
  getInfoAsync: jest.fn(async () => ({ exists: true, size: 1024 })),
  readAsStringAsync: jest.fn(async () => "base64content"),
  writeAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  cacheDirectory: "/cache/",
  documentDirectory: "/documents/",
}));

// Mock image-processor module to prevent import chain issues
jest.mock("@/modules/media/image-processor", () => ({
  __esModule: true,
  processProfileImage: jest.fn(async (uri) => uri),
  ImageProcessingError: class ImageProcessingError extends Error {},
}));
