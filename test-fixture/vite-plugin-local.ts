/**
 * Local vite plugin for TNFronte — injects data-oid into JSX elements.
 *
 * This is a simplified version of @tnfronte/dev-server that works
 * without Node ESM resolution issues in vite.config.ts.
 */
import type { Plugin, ViteDevServer } from 'vite';

// Lazy-loaded state
let lazyInit: Promise<void> | null = null;
let reactInjectOID: ((source: string, filePath: string) => any) | null = null;
let bridgeSource = '';

async function ensureInit() {
  if (lazyInit) return lazyInit;
  lazyInit = (async () => {
    const fs = await import('fs');
    const path = await import('path');

    // Load bridge script
    try {
      bridgeSource = fs.readFileSync(
        path.resolve(__dirname, '../packages/bridge/dist/bridge.js'),
        'utf-8',
      );
    } catch {
      bridgeSource = 'console.warn("[TNFronte] Bridge not built yet.");';
    }

    // Load react-adapter injectOID
    try {
      const mod = await import('@tnfronte/react-adapter');
      reactInjectOID = mod.injectOID;
    } catch (e) {
      console.error('[TNFronte] Failed to load react-adapter:', e);
    }
  })();
  return lazyInit;
}

export function tnfronteLocalPlugin(): Plugin {
  // Simple OID tracking for the layers API
  const oidMap = new Map<string, any[]>();

  return {
    name: 'tnfronte-local',
    enforce: 'pre',

    // OID injection transform
    async transform(code, id) {
      if (id.includes('node_modules')) return null;

      await ensureInit();
      if (!reactInjectOID) return null;

      if (id.endsWith('.tsx') || id.endsWith('.jsx')) {
        try {
          const result = reactInjectOID(code, id);
          if (result && result.mappings?.length > 0) {
            oidMap.set(id, result.mappings);
            return { code: result.code, map: null };
          }
        } catch {
          return null;
        }
      }
      return null;
    },

    // Inject Bridge + styles into HTML
    transformIndexHtml: {
      enforce: 'post',
      transform() {
        return [
          {
            tag: 'script',
            children: `window.__TNFRONTE_EDITING__ = true; window.__TNFRONTE_EDITOR_ORIGIN__ = 'http://localhost:5173';`,
            injectTo: 'head' as const,
          },
          {
            tag: 'script',
            attrs: { type: 'module' },
            children: bridgeSource,
            injectTo: 'body' as const,
          },
          {
            tag: 'style',
            children: `
              .__tnfronte_highlight {
                outline: 2px solid #3b82f6 !important;
                outline-offset: 2px !important;
              }
              [data-oid]:hover {
                outline: 1px dashed #93c5fd !important;
              }
            `,
            injectTo: 'head' as const,
          },
        ];
      },
    },

    // Serve layers API
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/__tnfronte_api/layers', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        const all = Array.from(oidMap.values()).flat();
        res.end(JSON.stringify(
          all.map(m => ({
            oid: m.id,
            tag: m.tagName,
            file: m.filePath,
            line: m.startLine,
            component: m.componentScope,
          })),
        ));
      });
    },
  };
}
