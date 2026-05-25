import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  // SWC handles TS decorators + emitDecoratorMetadata that NestJS relies on.
  plugins: [swc.vite()],
});
