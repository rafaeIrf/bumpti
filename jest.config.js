module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  setupFiles: ["<rootDir>/jest.setup.js"],
  globals: {
    "ts-jest": {
      tsconfig: "<rootDir>/tsconfig.jest.json",
    },
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
};
