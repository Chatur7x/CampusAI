import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // Exclude the server (separate Node.js project) and build output
  { ignores: ['dist', 'server/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Downgrade to warning — complex Supabase types legitimately need any in many spots
      '@typescript-eslint/no-explicit-any': 'warn',
      // Allow underscore-prefixed variables to be unused (convention for intentional ignores)
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.{jsx,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    ...reactRefresh.configs.vite,
    files: ['**/*.{jsx,tsx}'],
    rules: {
      // shadcn/ui components export both components and variants — this is by design
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
)
