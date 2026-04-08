/**
 * apply-action.ts
 *
 * Locates a JSX element by its `data-oid` attribute and applies a CodeAction
 * (modify style, prop, text, move, resize, delete, insert, reorder).
 *
 * Uses recast to preserve original formatting and minimise diffs.
 */

import * as recast from 'recast';
import { parse as babelParse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

import type { OID, CodeAction } from '@tnfronte/shared';

const tsxParser = {
  parse(source: string) {
    return babelParse(source, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy', 'importMeta'],
    });
  },
};

export function applyAction(source: string, oid: OID, action: CodeAction): string {
  const ast = recast.parse(source, { parser: tsxParser });

  traverse(ast, {
    JSXOpeningElement(path) {
      if (!findMatchingOID(path, oid.id)) return;

      switch (action.type) {
        case 'MODIFY_STYLE':
          modifyStyle(path, action.prop, action.value);
          break;
        case 'MODIFY_PROP':
          modifyProp(path, action.prop, action.value);
          break;
        case 'MODIFY_TEXT':
          modifyText(path, action.value);
          break;
        case 'MOVE':
          modifyStyle(path, action.positionProp, `${action.deltaX}px`);
          break;
        case 'RESIZE':
          if (action.width != null) modifyStyle(path, 'width', `${action.width}px`);
          if (action.height != null) modifyStyle(path, 'height', `${action.height}px`);
          break;
        case 'DELETE':
          deleteElement(path);
          break;
        case 'INSERT':
          // handled at parent level — see INSERT handler below
          break;
      }
    },
  });

  // Handle INSERT (find parent, insert child)
  if (action.type === 'INSERT') {
    traverse(ast, {
      JSXOpeningElement(path) {
        if (!findMatchingOID(path, action.parentOID)) return;
        const parentEl = path.parentPath;
        if (!parentEl?.isJSXElement()) return;

        // Parse the insertion code as JSX
        const childAst = recast.parse(`<>{${action.code}}</>`, { parser: tsxParser });
        // Extract children from fragment
        let inserted = false;
        traverse(childAst, {
          JSXFragment(fragPath) {
            if (inserted) return;
            const children = fragPath.node.children.filter(
              (c) => !(t.isJSXText(c) && c.value.trim() === ''),
            );
            for (let i = 0; i < children.length; i++) {
              const idx = Math.min(action.index + i, parentEl.node.children.length);
              parentEl.node.children.splice(idx, 0, children[i]);
            }
            inserted = true;
          },
          JSXElement(elPath) {
            if (inserted) return;
            const idx = Math.min(action.index, parentEl.node.children.length);
            parentEl.node.children.splice(idx, 0, elPath.node as any);
            inserted = true;
          },
        });
      },
    });
  }

  return recast.print(ast).code;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function findMatchingOID(path: any, oidId: string): boolean {
  const attrs: t.JSXAttribute[] = path.node.attributes;
  return attrs.some(
    (attr) =>
      t.isJSXAttribute(attr) &&
      t.isJSXIdentifier(attr.name) &&
      attr.name.name === 'data-oid' &&
      t.isStringLiteral(attr.value) &&
      attr.value.value === oidId,
  );
}

function modifyStyle(path: any, cssProp: string, value: string) {
  const jsKey = camelCase(cssProp);
  const styleAttr = findAttr(path, 'style');

  if (styleAttr && t.isJSXAttribute(styleAttr)) {
    const expr = (styleAttr.value as t.JSXExpressionContainer)?.expression;
    if (t.isObjectExpression(expr)) {
      const existing = expr.properties.find(
        (p) => t.isObjectProperty(p) && t.isIdentifier(p.key) && p.key.name === jsKey,
      ) as t.ObjectProperty | undefined;

      if (existing) {
        existing.value = t.stringLiteral(value);
      } else {
        expr.properties.push(
          t.objectProperty(t.identifier(jsKey), t.stringLiteral(value)),
        );
      }
    }
  } else {
    // Create new style={{ prop: value }}
    path.node.attributes.push(
      t.jsxAttribute(
        t.jsxIdentifier('style'),
        t.jsxExpressionContainer(
          t.objectExpression([
            t.objectProperty(t.identifier(jsKey), t.stringLiteral(value)),
          ]),
        ),
      ),
    );
  }
}

function modifyProp(path: any, prop: string, value: string) {
  const existing = findAttr(path, prop);
  if (existing && t.isJSXAttribute(existing)) {
    existing.value = t.stringLiteral(value);
  } else {
    path.node.attributes.push(
      t.jsxAttribute(t.jsxIdentifier(prop), t.stringLiteral(value)),
    );
  }
}

function modifyText(path: any, newText: string) {
  const parent = path.parent;
  if (t.isJSXElement(parent)) {
    // Replace first text child or add one
    const textChild = parent.children?.find((c) => t.isJSXText(c));
    if (textChild) {
      (textChild as t.JSXText).value = newText;
    } else if (parent.children) {
      parent.children.unshift(t.jsxText(newText));
    }
  }
}

function deleteElement(path: any) {
  const jsxEl = path.parentPath;
  if (!jsxEl?.isJSXElement()) return;
  const grandParent = jsxEl.parentPath;
  if (grandParent?.isJSXElement() || grandParent?.isJSXFragment()) {
    const children = grandParent.node.children as any[];
    const idx = children.indexOf(jsxEl.node);
    if (idx > -1) children.splice(idx, 1);
  }
}

function findAttr(path: any, name: string): t.JSXAttribute | undefined {
  return path.node.attributes.find(
    (a: t.JSXAttribute) =>
      t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === name,
  );
}

function camelCase(s: string): string {
  return s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}
