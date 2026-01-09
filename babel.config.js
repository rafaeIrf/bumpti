module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // WatermelonDB decorators
      ["@babel/plugin-proposal-decorators", { legacy: true }],
      // Reanimated (deve ser o último)
      "react-native-reanimated/plugin",
    ],
  };
};
