/**
 * Configuration constants for the Editor UI.
 *
 * Centralises all backend/dev-server URLs so they can be changed in one place.
 * Uses Vite env variables (import.meta.env) for browser-side config.
 */

/** TNFronte backend (Fastify) base URL */
export const BACKEND_URL = import.meta.env.VITE_TNFRONTE_BACKEND_URL || 'http://localhost:4000';

/** User project dev-server base URL (for bridge API) */
export const DEV_SERVER_URL =
  import.meta.env.VITE_TNFRONTE_DEV_SERVER_URL || 'http://localhost:5173';

/** WebSocket URL for backend communication */
export const WS_URL = BACKEND_URL.replace(/^http/, 'ws') + '/ws';

/** API endpoints */
export const API = {
  health: `${BACKEND_URL}/api/health`,
  project: `${BACKEND_URL}/api/project`,
  projectOpen: `${BACKEND_URL}/api/project/open`,
  layers: `${BACKEND_URL}/api/layers`,
  oid: (id: string) => `${BACKEND_URL}/api/oid/${id}`,
  oidProps: (id: string) => `${BACKEND_URL}/api/oid/${id}/props`,
  file: `${BACKEND_URL}/api/file`,
  undo: `${BACKEND_URL}/api/undo`,
  redo: `${BACKEND_URL}/api/redo`,
  /** Dev-server OID layers endpoint (served by vite-plugin) */
  devLayers: `${DEV_SERVER_URL}/__tnfronte_api/layers`,
} as const;
