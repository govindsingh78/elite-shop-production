// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // Resolve the "@/..." imports from jsconfig.json, the same way Metro does.
    settings: {
      'import/resolver': {
        typescript: { project: './jsconfig.json' },
      },
    },
  },
]);
