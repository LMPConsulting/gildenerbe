import { defineConfig } from 'vite';

export default defineConfig({
  base: './',            // relative asset paths — required for Capacitor (file://) later
  build: { outDir: 'dist', emptyOutDir: true },
  server: { port: 5173, open: false },
});
