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

export { createServer } from './server';
export { WebSocketHub } from './ws-hub';
