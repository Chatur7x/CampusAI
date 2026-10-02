import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // Exclude the server (separate Node.js project) and build output
  // scratch/ + tmp/ are throwaway dev scripts — never gate CI on them.
  // supabase/functions run on Deno, not Node/browser — separate runtime.
  { ignores: ['dist', 'server--backend/**', 'ai-server/**', 'seed_users.mjs', 'scratch/**', 'tmp/**', 'public/**', 'supabase/functions/**', '.venv/**', 'dist-ssr/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Node.js seed scripts
    files: ['**/*.mjs'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-unused-vars': 'off',
    },
  },
  {
    files: ['**/*.{jsx,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
)
