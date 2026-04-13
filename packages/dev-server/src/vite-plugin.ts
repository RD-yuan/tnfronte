import type { Plugin, ViteDevServer } from 'vite';
import { OIDIndex } from '@tnfronte/oid-index';
import { injectOID as reactInjectOID } from '@tnfronte/react-adapter/dist/inject-oid';
import type { FrameworkAdapter, InjectionResult } from '@tnfronte/shared';

export interface TnfrontePluginOptions {
  /** Extra framework adapters to register. */
  adapters?: FrameworkAdapter[];
}

export function tnfronteVitePlugin(options: TnfrontePluginOptions = {}): Plugin {
  const oidIndex = new OIDIndex();
  let bridgeSource = '';

  return {
    name: 'tnfronte-inject',
    enforce: 'pre',

    async configResolved() {
      // Try to load the pre-built bridge script
      try {
        const fs = await import('fs');
        const path = await import('path');
        const bridgePath = path.resolve(
          __dirname,
          '../../bridge/dist/bridge.js',
        );
        bridgeSource = fs.readFileSync(bridgePath, 'utf-8');
      } catch {
        bridgeSource = `
          // TNFronte Bridge — inline fallback
          console.warn('[TNFronte] Bridge script not built yet. Run pnpm build in packages/bridge.');
        `;
      }
    },

    // ─── Transform: inject data-oid into JSX / Vue / HTML ────────────
    async transform(code, id) {
      if (id.includes('node_modules')) return null;
      if (id.includes('.tnfronte-tmp')) return null;

      let result: InjectionResult | null = null;

      try {
        if (id.endsWith('.tsx') || id.endsWith('.jsx')) {
          result = reactInjectOID(code, id);
        }
        // TODO: Vue, Svelte, HTML adapters — plug in here
      } catch (err) {
        // Silently skip files that fail to parse
        return null;
      }

      if (result && result.mappings.length > 0) {
        oidIndex.updateMappings(id, result.mappings);
        return { code: result.code, map: null };
      }

      return null;
    },

    // ─── Inject Bridge script into HTML ──────────────────────────────
    transformIndexHtml: {
      enforce: 'post',
      transform(html: string, ctx: { server?: ViteDevServer }) {
        const editorOrigin = ctx.server?.resolvedUrls?.local[0] || '';
        return [
          // Editing mode flag + editor origin (for Bridge security)
          {
            tag: 'script',
            children: `window.__TNFRONTE_EDITING__ = true; window.__TNFRONTE_EDITOR_ORIGIN__ = ${JSON.stringify(editorOrigin)};`,
            injectTo: 'head' as const,
          },
          // Bridge script
          {
            tag: 'script',
            attrs: { type: 'module' },
            children: bridgeSource,
            injectTo: 'body' as const,
          },
          // Highlight styles
          {
            tag: 'style',
            children: `
              .__tnfronte_highlight {
                outline: 2px solid #3b82f6 !important;
                outline-offset: 2px !important;
                transition: outline 0.1s ease;
              }
              [data-oid]:hover {
                outline: 1px dashed #93c5fd !important;
                outline-offset: 1px !important;
              }
            `,
            injectTo: 'head' as const,
          },
        ];
      },
    },

    // ─── Dev-server middleware: Bridge bundle + OID API ───────────────
    configureServer(server: ViteDevServer) {
      // Serve Bridge script
      server.middlewares.use('/__tnfronte_bridge__.js', (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(bridgeSource);
      });

      // Serve OID mappings as JSON
      server.middlewares.use('/__tnfronte_api/mappings', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify(oidIndex.getAll()));
      });

      // Serve flat OID list (for layer tree)
      server.middlewares.use('/__tnfronte_api/layers', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(
          JSON.stringify(
            oidIndex.getAll().map((m) => ({
              oid: m.id,
              tag: m.tagName,
              file: m.filePath,
              line: m.startLine,
              component: m.componentScope,
            })),
          ),
        );
      });
    },
  };
}
