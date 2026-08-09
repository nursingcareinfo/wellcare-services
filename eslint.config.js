import js from '@eslint/js'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import prettier from 'eslint-config-prettier/flat'

export default [
  // 1. Global ignores
  {
    ignores: ['dist/', 'node_modules/', '.kilo/'],
  },

  // 2. ESLint recommended (eslint:recommended equivalent)
  js.configs.recommended,

  // 3. @typescript-eslint recommended (flat config)
  ...tsPlugin.configs['flat/recommended'],

  // 4. Custom project rules (override recommended)
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // 5. Prettier (must be last to turn off conflicting rules)
  prettier,
]
