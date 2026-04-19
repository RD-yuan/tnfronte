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

import * as path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from './server';

const isDirectRun =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const rawPort = Number(process.env.PORT ?? '4000');
  const port = Number.isFinite(rawPort) && rawPort > 0 ? rawPort : 4000;

  createServer({ port }).catch((err) => {
    console.error('[TNFronte] Failed to start backend:', err);
    process.exit(1);
  });
}

export { createServer } from './server';
export { WebSocketHub } from './ws-hub';
