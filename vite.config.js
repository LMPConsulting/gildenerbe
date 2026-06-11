import { defineConfig } from 'vite';

export default defineConfig({
  base: './',            // relative asset paths — required for Capacitor (file://) later
  build: { outDir: 'dist', emptyOutDir: true },
  server: { port: Number(process.env.PORT) || 5173, open: false },
});
