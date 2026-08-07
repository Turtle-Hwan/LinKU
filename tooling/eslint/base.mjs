import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export const baseConfig = tseslint.config(
  { ignores: ["dist", "gh-pages", "node_modules"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-console": "error",
      "react-hooks/immutability": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: ["**/src/utils/logger.ts", "**/vite.config.ts"],
    rules: {
      "no-console": "off",
    },
  },
  {
    files: [
      "src/components/ui/*.tsx",
      "src/components/button.tsx",
      "src/components/badge.tsx",
    ],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
);

export default baseConfig;
