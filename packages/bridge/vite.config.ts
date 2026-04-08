import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/bridge.ts'),
      name: 'TNFronteBridge',
      formats: ['iife'],
      fileName: () => 'bridge.js',
    },
    outDir: 'dist',
    minify: false,
    sourcemap: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
