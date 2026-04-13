import Fastify, { FastifyInstance } from 'fastify';
import { WebSocketServer, WebSocket } from 'ws';
import * as http from 'http';
import * as fs from 'fs/promises';
import * as path from 'path';

import { OIDIndex } from '@tnfronte/oid-index';
import { CodeModEngine } from '@tnfronte/code-mod';
import { ReactAdapter } from '@tnfronte/react-adapter';
import type { ClientMessage, LayerInfo } from '@tnfronte/shared';
import { WebSocketHub } from './ws-hub.ts';
import { ProjectManager } from './project-manager.ts';
import { UndoManager } from './undo-manager.ts';

export interface ServerOptions {
  port?: number;
}

export async function createServer(options: ServerOptions = {}): Promise<FastifyInstance> {
  const port = options.port ?? 4000;
  const fastify = Fastify({ logger: false });

  // ─── Initialise core services ───────────────────────────────────────
  const oidIndex = new OIDIndex();
  const codeModEngine = new CodeModEngine(oidIndex);
  codeModEngine.registerAdapter(new ReactAdapter());

  const wsHub = new WebSocketHub();
  const projectManager = new ProjectManager();
  const undoManager = new UndoManager();

  // ─── HTTP Routes ────────────────────────────────────────────────────

  // Health check
  fastify.get('/api/health', async () => ({ status: 'ok', timestamp: Date.now() }));

  // Open a project directory
  fastify.post<{ Body: { dir: string } }>('/api/project/open', async (req, reply) => {
    const { dir } = req.body;
    try {
      const stat = await fs.stat(dir);
      if (!stat.isDirectory()) {
        return reply.status(400).send({ error: 'Not a directory' });
      }
      projectManager.setProjectDir(dir);
      await scanProject(dir, oidIndex);
      wsHub.broadcast({
        kind: 'layers',
        layers: oidIndex.getAll().map(toLayerInfo),
      });
      return { success: true, dir, oidCount: oidIndex.size };
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  });

  // Get current project info
  fastify.get('/api/project', async () => {
    const dir = projectManager.getProjectDir();
    return {
      dir,
      oidCount: oidIndex.size,
      files: oidIndex.getFiles(),
    };
  });

  // Get layers
  fastify.get('/api/layers', async () => {
    return oidIndex.getAll().map(toLayerInfo);
  });

  // Get OID mapping
  fastify.get<{ Params: { id: string } }>('/api/oid/:id', async (req) => {
    const oid = oidIndex.getById(req.params.id);
    if (!oid) return { error: 'OID not found' };
    return oid;
  });

  // Read file
  fastify.get<{ Querystring: { path: string } }>('/api/file', async (req, reply) => {
    const filePath = req.query.path;
    const projectDir = projectManager.getProjectDir();
    if (!projectDir) return reply.status(400).send({ error: 'No project open' });

    const absPath = path.resolve(projectDir, filePath);
    if (!absPath.startsWith(projectDir)) {
      return reply.status(403).send({ error: 'Path outside project' });
    }

    try {
      const content = await fs.readFile(absPath, 'utf-8');
      return { path: filePath, content };
    } catch {
      return reply.status(404).send({ error: 'File not found' });
    }
  });

  // Undo
  fastify.post('/api/undo', async () => {
    const result = await undoManager.undo();
    return result;
  });

  // Redo
  fastify.post('/api/redo', async () => {
    const result = await undoManager.redo();
    return result;
  });

  // ─── WebSocket Server ───────────────────────────────────────────────
  const wss = new WebSocketServer({ server: fastify.server, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('[TNFronte] Editor client connected');
    wsHub.add(ws);
    wsHub.send(ws, { kind: 'connected', message: 'TNFronte backend connected' });

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as ClientMessage;

        switch (msg.kind) {
          case 'action': {
            // Save state for undo before applying
            const oid = oidIndex.getById(msg.oidId);
            if (oid) {
              const projectDir = projectManager.getProjectDir();
              if (projectDir) {
                const absPath = path.resolve(projectDir, oid.filePath);
                const oldContent = await fs.readFile(absPath, 'utf-8');
                const undoEntry = undoManager.push({
                  filePath: absPath,
                  oldContent,
                  description: `${msg.action.type} on ${oid.tagName}`,
                });

                // Apply the action
                const result = await codeModEngine.applyAndWrite(msg.oidId, msg.action);

                // Record content after edit for consistency check
                if (result.success) {
                  try {
                    const newContent = await fs.readFile(result.filePath, 'utf-8');
                    undoManager.pushNewContent(undoEntry, newContent);
                  } catch {
                    // File read failed — skip consistency tracking for this entry
                  }
                }

                wsHub.send(ws, {
                  kind: 'action-result',
                  success: result.success,
                  filePath: result.filePath,
                });
                break;
              }
            }

            // No project dir or OID not found — apply without undo
            const result = await codeModEngine.applyAndWrite(msg.oidId, msg.action);
            wsHub.send(ws, {
              kind: 'action-result',
              success: result.success,
              filePath: result.filePath,
            });
            break;
          }

          default:
            wsHub.send(ws, { kind: 'error', message: `Unknown message kind` });
        }
      } catch (err: any) {
        wsHub.send(ws, { kind: 'error', message: err.message });
      }
    });
  });

  // ─── Start ──────────────────────────────────────────────────────────
  await fastify.listen({ port, host: '0.0.0.0' });
  console.log(`[TNFronte] Backend running on http://localhost:${port}`);
  console.log(`[TNFronte] WebSocket on ws://localhost:${port}/ws`);

  return fastify;
}

// ─── Helpers ──────────────────────────────────────────────────────────

async function scanProject(dir: string, index: OIDIndex) {
  const adapter = new ReactAdapter();
  await walk(dir, dir, async (absPath, relPath) => {
    if (relPath.includes('node_modules')) return;
    if (relPath.includes('.tnfronte-tmp')) return;
    if (!(absPath.endsWith('.tsx') || absPath.endsWith('.jsx'))) return;

    try {
      const source = await fs.readFile(absPath, 'utf-8');
      const result = await adapter.injectOID(source, absPath);
      index.updateMappings(absPath, result.mappings);
    } catch {
      // Skip files that fail to parse
    }
  });
}

async function walk(
  root: string,
  current: string,
  fn: (absPath: string, relPath: string) => Promise<void>,
) {
  const entries = await fs.readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    const absPath = path.join(current, entry.name);
    const relPath = path.relative(root, absPath);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
      await walk(root, absPath, fn);
    } else {
      await fn(absPath, relPath);
    }
  }
}

function toLayerInfo(m: any): LayerInfo {
  return {
    oid: m.id,
    tagName: m.tagName,
    component: m.componentScope,
    filePath: m.filePath,
    line: m.startLine,
  };
}
