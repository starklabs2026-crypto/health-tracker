/**
 * Shared ESLint config for the Medical Tracker monorepo (Node/TypeScript).
 * Apps and packages extend this via: { root: true, extends: ['custom'] }.
 */
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    // R.1: no `any` — use `unknown` and narrow.
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/no-non-null-assertion': 'warn',
  },
  overrides: [
    {
      // Tests may use non-null assertions on known-present fixtures.
      files: ['*.test.ts', '*.spec.ts'],
      rules: {
        '@typescript-eslint/no-non-null-assertion': 'off',
      },
    },
  ],
  ignorePatterns: ['dist', 'build', '.next', 'node_modules', 'coverage', '*.config.js', '*.config.cjs'],
};
