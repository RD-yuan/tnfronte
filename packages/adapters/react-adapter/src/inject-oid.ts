/**
 * inject-oid.ts
 *
 * Parses a JSX/TSX source file, injects `data-oid` attributes onto every
 * JSX element, and returns the modified code along with a mapping table.
 *
 * The OID is a deterministic hash of (filePath + startLine + startCol) so
 * it stays stable across re-injections.
 */

import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import { createHash } from 'crypto';

import type { OID, InjectionResult } from '@tnfronte/shared';

function makeOID(filePath: string, line: number, col: number): string {
  const raw = `${filePath}:${line}:${col}`;
  return 'oid-' + createHash('md5').update(raw).digest('hex').slice(0, 10);
}

export function injectOID(source: string, filePath: string): InjectionResult {
  const mappings: OID[] = [];
  let currentComponent = 'Anonymous';

  const ast = parse(source, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript', 'decorators-legacy', 'importMeta'],
    errorRecovery: true,
  });

  traverse(ast, {
    // ── Track component scope ────────────────────────────────────────
    FunctionDeclaration(path) {
      if (
        path.parentPath.isProgram() ||
        path.parentPath.isExportDefaultDeclaration()
      ) {
        currentComponent = path.node.id?.name ?? 'Anonymous';
      }
    },
    ArrowFunctionExpression(path) {
      // const MyComp = () => { ... }
      const parent = path.parentPath;
      if (
        parent.isVariableDeclarator() &&
        parent.parentPath?.isVariableDeclaration() &&
        parent.parentPath.parentPath?.isProgram()
      ) {
        const id = parent.node.id;
        if (t.isIdentifier(id)) currentComponent = id.name;
      }
    },

    // ── Inject data-oid ──────────────────────────────────────────────
    JSXOpeningElement(path) {
      // Skip if already injected
      const hasOID = path.node.attributes.some(
        (attr) =>
          t.isJSXAttribute(attr) &&
          t.isJSXIdentifier(attr.name) &&
          attr.name.name === 'data-oid',
      );
      if (hasOID) return;

      const tagName = t.isJSXIdentifier(path.node.name)
        ? path.node.name.name
        : null;
      if (!tagName) return; // skip <Component.Prop> etc.

      const loc = path.node.loc;
      if (!loc) return;

      const id = makeOID(filePath, loc.start.line, loc.start.column);

      mappings.push({
        id,
        filePath,
        startLine: loc.start.line,
        startCol: loc.start.column,
        endLine: loc.end.line,
        endCol: loc.end.column,
        componentScope: currentComponent,
        tagName,
      });

      path.node.attributes.unshift(
        t.jsxAttribute(t.jsxIdentifier('data-oid'), t.stringLiteral(id)),
      );
    },
  });

  const output = generate(ast, { retainLines: true, compact: false });

  return { code: output.code, mappings };
}
