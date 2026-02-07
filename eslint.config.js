// https://docs.expo.dev/guides/using-eslint/
/* eslint-disable no-restricted-syntax */
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      "dist/*",
      "*.config.js",
      "*.config.ts",
      "jest.setup.js",
      ".eslintrc.*",
    ],
  },
  {
    settings: {
      "import/resolver": {
        typescript: {
          project: "./tsconfig.json",
        },
      },
    },
    rules: {
      // Prohibit dynamic imports - ALWAYS use static imports at the top
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportExpression",
          message:
            "Dynamic imports are not allowed. Use static import statements at the top of the file instead.",
        },
        {
          selector: "CallExpression[callee.name='require']",
          message:
            "Dynamic require() is not allowed. Use static import statements at the top of the file instead.",
        },
        {
          selector: "TSImportType",
          message:
            "Inline import('...') types are not allowed. Use a regular 'import type { ... }' at the top of the file instead.",
        },
      ],
    },
  },
]);
