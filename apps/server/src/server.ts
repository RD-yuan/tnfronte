import Fastify, { FastifyInstance } from 'fastify';
import chokidar, { type FSWatcher } from 'chokidar';
import { WebSocketServer } from 'ws';
import * as fs from 'fs/promises';
import * as path from 'path';

import { OIDIndex } from '@tnfronte/oid-index';
import { CodeModEngine } from '@tnfronte/code-mod';
import { ReactAdapter } from '@tnfronte/react-adapter';
import type { ClientMessage, LayerInfo } from '@tnfronte/shared';
import { WebSocketHub } from './ws-hub';
import { ProjectManager } from './project-manager';
import { UndoManager } from './undo-manager';

export interface ServerOptions {
  port?: number;
}

const SOURCE_EXTENSIONS = new Set(['.tsx', '.jsx']);
const IGNORED_SEGMENTS = new Set(['node_modules', '.git', 'dist', '.turbo']);

export async function createServer(options: ServerOptions = {}): Promise<FastifyInstance> {
  const port = options.port ?? 4000;
  const fastify = Fastify({ logger: false });

  const oidIndex = new OIDIndex();
  const codeModEngine = new CodeModEngine(oidIndex);
  const reactAdapter = new ReactAdapter();
  codeModEngine.registerAdapter(reactAdapter);

  const wsHub = new WebSocketHub();
  const projectManager = new ProjectManager();
  const undoManager = new UndoManager();
  let projectWatcher: FSWatcher | null = null;
  let syncQueue = Promise.resolve();

  const currentLayers = () => getLayers(oidIndex);

  const enqueueSync = async <T>(task: () => Promise<T>): Promise<T> => {
    const next = syncQueue.then(task, task);
    syncQueue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };

  const broadcastLayers = () => {
    wsHub.broadcast({ kind: 'layers', layers: currentLayers() });
  };

  const broadcastFileChanged = (filePath: string) => {
    wsHub.broadcast({ kind: 'file-changed', filePath });
  };

  const syncIndexedFile = async (filePath: string) =>
    enqueueSync(() => refreshIndexedFile(filePath, oidIndex, reactAdapter));

  const rescanProject = async (projectDir: string) =>
    enqueueSync(async () => {
      oidIndex.clear();
      await scanProject(projectDir, oidIndex, reactAdapter);
    });

  const syncProjectStateForFile = async (filePath: string) => {
    const absolutePath = path.resolve(filePath);

    if (isSupportedSourceFile(absolutePath)) {
      await syncIndexedFile(absolutePath);
    }

    broadcastFileChanged(absolutePath);
    broadcastLayers();
  };

  const stopWatchingProject = async () => {
    if (!projectWatcher) return;

    const watcher = projectWatcher;
    projectWatcher = null;
    await watcher.close();
  };

  const startWatchingProject = async (projectDir: string) => {
    await stopWatchingProject();

    const watcher = chokidar.watch(projectDir, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 150,
        pollInterval: 50,
      },
      ignored: (candidate) => shouldIgnorePath(candidate),
    });
    projectWatcher = watcher;

    const handleSourceUpdate = async (candidate: string) => {
      const absolutePath = path.resolve(candidate);
      if (!isSupportedSourceFile(absolutePath)) return;

      await syncProjectStateForFile(absolutePath);
    };

    watcher.on('add', (candidate) => {
      void handleSourceUpdate(candidate);
    });
    watcher.on('change', (candidate) => {
      void handleSourceUpdate(candidate);
    });
    watcher.on('unlink', (candidate) => {
      const absolutePath = path.resolve(candidate);
      if (!isSupportedSourceFile(absolutePath)) return;

      oidIndex.removeFile(absolutePath);
      broadcastFileChanged(absolutePath);
      broadcastLayers();
    });
    watcher.on('error', (err) => {
      console.error('[TNFronte] Project watcher error:', err);
    });
  };

  const wss = new WebSocketServer({ server: fastify.server, path: '/ws' });

  fastify.addHook('onClose', async () => {
    await stopWatchingProject();
    await new Promise<void>((resolve) => wss.close(() => resolve()));
  });

  fastify.get('/api/health', async () => ({
    status: 'ok',
    timestamp: Date.now(),
    projectDir: projectManager.getProjectDir(),
    oidCount: oidIndex.size,
    watching: Boolean(projectWatcher),
    canUndo: undoManager.canUndo,
    canRedo: undoManager.canRedo,
  }));

  fastify.post<{ Body: { dir: string } }>('/api/project/open', async (req, reply) => {
    const { dir } = req.body;
    if (!dir) {
      return reply.status(400).send({ error: 'Project directory is required' });
    }

    const projectDir = path.resolve(dir);

    try {
      const stat = await fs.stat(projectDir);
      if (!stat.isDirectory()) {
        return reply.status(400).send({ error: 'Not a directory' });
      }

      projectManager.setProjectDir(projectDir);
      undoManager.clear();
      await rescanProject(projectDir);
      await startWatchingProject(projectDir);
      broadcastLayers();

      return {
        success: true,
        dir: projectDir,
        oidCount: oidIndex.size,
        fileCount: oidIndex.getFiles().length,
        watching: true,
      };
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  });

  fastify.get('/api/project', async () => ({
    dir: projectManager.getProjectDir(),
    oidCount: oidIndex.size,
    files: oidIndex.getFiles(),
    watching: Boolean(projectWatcher),
    canUndo: undoManager.canUndo,
    canRedo: undoManager.canRedo,
  }));

  fastify.get('/api/layers', async () => currentLayers());

  fastify.get<{ Params: { id: string } }>('/api/oid/:id', async (req, reply) => {
    const oid = oidIndex.getById(req.params.id);
    if (!oid) {
      return reply.status(404).send({ error: 'OID not found' });
    }

    return oid;
  });

  fastify.get<{ Params: { id: string } }>('/api/oid/:id/props', async (req, reply) => {
    const result = await codeModEngine.extractEditableProps(req.params.id);
    if (!result.success) {
      return reply.status(404).send({ error: 'OID not found or adapter unavailable' });
    }

    return {
      filePath: result.filePath,
      props: result.props,
    };
  });

  fastify.get<{ Querystring: { path: string } }>('/api/file', async (req, reply) => {
    const requestedPath = req.query.path;
    if (!projectManager.getProjectDir()) {
      return reply.status(400).send({ error: 'No project open' });
    }
    if (!requestedPath) {
      return reply.status(400).send({ error: 'File path is required' });
    }

    const absolutePath = projectManager.resolvePath(requestedPath);
    if (!absolutePath) {
      return reply.status(403).send({ error: 'Path outside project' });
    }

    try {
      const content = await fs.readFile(absolutePath, 'utf-8');
      return { path: projectManager.toProjectPath(absolutePath), content };
    } catch {
      return reply.status(404).send({ error: 'File not found' });
    }
  });

  fastify.post('/api/undo', async () => {
    const result = await undoManager.undo();
    if (result.success && result.filePath) {
      await syncProjectStateForFile(result.filePath);
    }

    return result;
  });

  fastify.post('/api/redo', async () => {
    const result = await undoManager.redo();
    if (result.success && result.filePath) {
      await syncProjectStateForFile(result.filePath);
    }

    return result;
  });

  wss.on('connection', (ws) => {
    console.log('[TNFronte] Editor client connected');
    wsHub.add(ws);
    wsHub.send(ws, { kind: 'connected', message: 'TNFronte backend connected' });
    wsHub.send(ws, { kind: 'layers', layers: currentLayers() });

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as ClientMessage;

        switch (msg.kind) {
          case 'action': {
            const oid = oidIndex.getById(msg.oidId);
            if (!oid) {
              wsHub.send(ws, { kind: 'error', message: `OID not found: ${msg.oidId}` });
              break;
            }

            const filePath = projectManager.resolvePath(oid.filePath) ?? oid.filePath;
            let undoEntry: ReturnType<UndoManager['push']> | undefined;
            let writeSucceeded = false;

            try {
              if (projectManager.getProjectDir()) {
                const oldContent = await fs.readFile(filePath, 'utf-8');
                undoEntry = undoManager.push({
                  filePath,
                  oldContent,
                  description: `${msg.action.type} on ${oid.tagName}`,
                });
              }

              const result = await codeModEngine.applyAndWrite(msg.oidId, msg.action);
              if (!result.success) {
                if (undoEntry) {
                  undoManager.discard(undoEntry);
                }

                wsHub.send(ws, {
                  kind: 'action-result',
                  success: false,
                  filePath: result.filePath,
                });
                break;
              }
              writeSucceeded = true;

              if (undoEntry) {
                try {
                  const newContent = await fs.readFile(result.filePath, 'utf-8');
                  undoManager.pushNewContent(undoEntry, newContent);
                } catch (err) {
                  console.warn(
                    `[TNFronte] Action applied but failed to record undo snapshot for ${result.filePath}:`,
                    err,
                  );
                }
              }

              await syncProjectStateForFile(result.filePath);

              wsHub.send(ws, {
                kind: 'action-result',
                success: true,
                filePath: result.filePath,
              });
              break;
            } catch (err) {
              if (undoEntry && !writeSucceeded) {
                undoManager.discard(undoEntry);
              }
              throw err;
            }
          }

          default:
            wsHub.send(ws, { kind: 'error', message: 'Unknown message kind' });
        }
      } catch (err: any) {
        wsHub.send(ws, { kind: 'error', message: err.message });
      }
    });
  });

  await fastify.listen({ port, host: '0.0.0.0' });
  console.log(`[TNFronte] Backend running on http://localhost:${port}`);
  console.log(`[TNFronte] WebSocket on ws://localhost:${port}/ws`);

  return fastify;
}

async function scanProject(dir: string, index: OIDIndex, adapter: ReactAdapter) {
  await walk(dir, dir, async (absPath, relPath) => {
    if (shouldIgnorePath(relPath) || !isSupportedSourceFile(absPath)) return;
    await refreshIndexedFile(absPath, index, adapter);
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
      if (shouldIgnorePath(relPath)) continue;
      await walk(root, absPath, fn);
    } else {
      await fn(absPath, relPath);
    }
  }
}

async function refreshIndexedFile(
  filePath: string,
  index: OIDIndex,
  adapter: ReactAdapter,
): Promise<boolean> {
  if (shouldIgnorePath(filePath) || !isSupportedSourceFile(filePath)) {
    return false;
  }

  try {
    const source = await fs.readFile(filePath, 'utf-8');
    const result = await adapter.injectOID(source, filePath);
    index.updateMappings(filePath, result.mappings);
    return true;
  } catch {
    index.removeFile(filePath);
    return false;
  }
}

function isSupportedSourceFile(filePath: string): boolean {
  return SOURCE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function shouldIgnorePath(candidatePath: string): boolean {
  if (!candidatePath) return false;

  const normalized = path.normalize(candidatePath);
  if (
    normalized.includes('.tnfronte-tmp') ||
    normalized.includes('.tnfronte-undo-tmp') ||
    normalized.includes('.tnfronte-redo-tmp')
  ) {
    return true;
  }

  return normalized
    .split(path.sep)
    .filter(Boolean)
    .some((segment) => IGNORED_SEGMENTS.has(segment));
}

function getLayers(index: OIDIndex): LayerInfo[] {
  return index
    .getAll()
    .sort((a, b) => {
      if (a.filePath === b.filePath) {
        return a.startLine - b.startLine || a.startCol - b.startCol;
      }

      return a.filePath.localeCompare(b.filePath);
    })
    .map(toLayerInfo);
}

function toLayerInfo(m: {
  id: string;
  tagName: string;
  componentScope: string;
  filePath: string;
  startLine: number;
}): LayerInfo {
  return {
    oid: m.id,
    tagName: m.tagName,
    component: m.componentScope,
    filePath: m.filePath,
    line: m.startLine,
  };
}
