// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  // On its own so it ignores these folders globally (build output and Expo's generated files).
  { ignores: ["dist/**", ".expo/**"] },
  {
    rules: {
      "react/no-unescaped-entities": "off",
    },
  },
]);
