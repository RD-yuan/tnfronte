import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tnfronteLocalPlugin } from './vite-plugin-local.ts';

export default defineConfig({
  plugins: [
    react(),
    tnfronteLocalPlugin(),
  ],
  server: {
    port: 5174,
    strictPort: true,
  },
});
