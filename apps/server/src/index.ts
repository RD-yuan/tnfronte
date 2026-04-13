/**
 * @tnfronte/server
 *
 * Editor Backend — Fastify HTTP + WebSocket server.
 *
 * Responsibilities:
 *  - Manage user projects (open, scan files)
 *  - Accept CodeActions via WebSocket, delegate to CodeModEngine
 *  - Spawn Vite dev-server for user projects
 *  - Push file-change notifications back to Editor UI
 */

import { createServer } from './server.ts';
export { createServer } from './server.ts';
export { WebSocketHub } from './ws-hub.ts';

// Auto-start when run directly (pnpm dev / pnpm start)
const isDirectRun =
  process.argv[1]?.includes('index.ts') || process.argv[1]?.includes('index.js');
if (isDirectRun) {
  createServer({ port: 4000 }).catch((err: Error) => {
    console.error('[TNFronte] Failed to start server:', err);
    process.exit(1);
  });
}
