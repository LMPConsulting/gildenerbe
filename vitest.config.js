import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',   // gives tests localStorage + DOM
    globals: true,          // describe/it/expect without imports
    include: ['tests/**/*.test.js'],
  },
});
