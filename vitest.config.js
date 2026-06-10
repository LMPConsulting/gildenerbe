import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Pure engine core needs no DOM. Add `// @vitest-environment jsdom` per-file
    // when UI tests arrive (later plans).
    environment: 'node',
    globals: true,          // describe/it/expect without imports
    include: ['tests/**/*.test.js'],
  },
});
