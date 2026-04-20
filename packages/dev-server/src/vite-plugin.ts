import type { Plugin, ViteDevServer } from 'vite';
import { HtmlAdapter } from '@tnfronte/html-adapter';
import { OIDIndex } from '@tnfronte/oid-index';
import { ReactAdapter } from '@tnfronte/react-adapter';
import type { FrameworkAdapter, InjectionResult, LayerInfo } from '@tnfronte/shared';

export interface TnfrontePluginOptions {
  /** Extra framework adapters to register. */
  adapters?: FrameworkAdapter[];
}

export function tnfronteVitePlugin(options: TnfrontePluginOptions = {}): Plugin {
  const oidIndex = new OIDIndex();
  const htmlAdapter = new HtmlAdapter();
  const adapters: FrameworkAdapter[] = [new ReactAdapter(), htmlAdapter, ...(options.adapters ?? [])];
  let bridgeSource = '';

  return {
    name: 'tnfronte-inject',
    enforce: 'pre',

    async configResolved() {
      try {
        const fs = await import('fs');
        const path = await import('path');
        const bridgePath = path.resolve(__dirname, '../../bridge/dist/bridge.js');
        bridgeSource = fs.readFileSync(bridgePath, 'utf-8');
      } catch {
        bridgeSource = `
          console.warn('[TNFronte] Bridge script not built yet. Run pnpm build in packages/bridge.');
        `;
      }
    },

    async transform(code, id) {
      const fileId = stripQuery(id);
      if (fileId.includes('node_modules')) return null;
      if (fileId.includes('.tnfronte-tmp')) return null;

      const adapter = adapters.find((candidate) =>
        candidate.extensions.some((ext) => fileId.endsWith(ext)),
      );
      if (!adapter) return null;

      let result: InjectionResult | null = null;

      try {
        result = await adapter.injectOID(code, fileId);
      } catch {
        oidIndex.removeFile(fileId);
        return null;
      }

      oidIndex.updateMappings(fileId, result.mappings);
      if (result.code !== code) {
        return { code: result.code, map: null };
      }

      return null;
    },

    transformIndexHtml: {
      enforce: 'post',
      async transform(html: string, ctx: { path: string; filename: string; server?: ViteDevServer }) {
        let injectedHtml = html;

        try {
          const result = await htmlAdapter.injectOID(html, ctx.filename);
          oidIndex.updateMappings(ctx.filename, result.mappings);
          injectedHtml = result.code;
        } catch {
          oidIndex.removeFile(ctx.filename);
        }

        return {
          html: injectedHtml,
          tags: [
          {
            tag: 'script',
            children: `
              window.__TNFRONTE_EDITING__ = true;
              window.__TNFRONTE_EDITOR_ORIGIN__ = document.referrer
                ? new URL(document.referrer).origin
                : '';
            `,
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
                transition: outline 0.1s ease;
              }
              [data-oid]:hover {
                outline: 1px dashed #93c5fd !important;
                outline-offset: 1px !important;
              }
            `,
            injectTo: 'head' as const,
          },
          ],
        };
      },
    },

    configureServer(server: ViteDevServer) {
      server.middlewares.use('/__tnfronte_bridge__.js', (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(bridgeSource);
      });

      server.middlewares.use('/__tnfronte_api/mappings', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify(oidIndex.getAll()));
      });

      server.middlewares.use('/__tnfronte_api/layers', (_req, res) => {
        const layers: LayerInfo[] = oidIndex.getAll().map((m) => ({
          oid: m.id,
          tagName: m.tagName,
          filePath: m.filePath,
          line: m.startLine,
          component: m.componentScope,
        }));

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify(layers));
      });
    },
  };
}

function stripQuery(id: string): string {
  return id.split('?')[0].split('#')[0];
}
