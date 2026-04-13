import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(async () => {
  // Dynamic import to avoid Node ESM resolution issues with workspace packages
  const { tnfronteVitePlugin } = await import('@tnfronte/dev-server/src/index.ts');
  
  return {
    plugins: [
      react(),
      tnfronteVitePlugin(),
    ],
    server: {
      port: 5174,
      strictPort: true,
    },
  };
});
