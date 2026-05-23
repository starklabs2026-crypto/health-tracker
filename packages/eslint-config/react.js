/**
 * React/React Native variant of the shared ESLint config.
 * Used by apps/mobile and apps/doctor-share.
 */
module.exports = {
  extends: ['./index.js'],
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  parserOptions: {
    ecmaFeatures: { jsx: true },
  },
};
