import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // `.worktrees` holds sibling checkouts with their own toolchains, so linting
  // them from here resolves their configs against the wrong node_modules.
  { ignores: ['dist', '.worktrees'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // LinKU does not use React Compiler yet. Keep the pre-7.1 lint contract
      // until compiler-oriented hook migrations can be handled separately.
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'no-console': 'error',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: ['src/utils/logger.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['vite.config.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['src/components/ui/button.tsx', 'src/components/ui/badge.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
)
