/**
 * apply-action.ts
 *
 * Locates a JSX element by its `data-oid` attribute and applies a CodeAction
 * (modify style, prop, text, move, resize, delete, insert, reorder).
 *
 * Uses @babel/parser + @babel/traverse + @babel/generator for AST
 * manipulation. Prettier (in code-mod engine) handles formatting.
 */

import { parse as babelParse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';

import type { OID, CodeAction } from '@tnfronte/shared';

export function applyAction(source: string, oid: OID, action: CodeAction): string {
  const ast = babelParse(source, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript', 'decorators-legacy', 'importMeta'],
    errorRecovery: true,
  });

  if (action.type === 'REORDER') {
    throw new Error('REORDER action is not yet implemented');
  }

  // Single pass: handle INSERT inline when we find the parent
  traverse(ast, {
    JSXOpeningElement(path) {
      // ── INSERT: find parent by OID and insert child ───────────────
      if (action.type === 'INSERT') {
        if (!findMatchingOID(path, action.parentOID)) return;

        const parentEl = path.parentPath;
        if (!parentEl?.isJSXElement()) return;

        // Parse the insertion code as JSX fragment
        const childAst = babelParse(`<__wrapper>${action.code}</__wrapper>`, {
          sourceType: 'module',
          plugins: ['jsx', 'typescript'],
        });

        traverse(childAst, {
          JSXElement(elPath) {
            const parent = elPath.parentPath;
            if (
              parent?.isJSXElement() &&
              t.isJSXIdentifier(parent.node.openingElement.name) &&
              parent.node.openingElement.name.name === '__wrapper'
            ) {
              const idx = Math.min(action.index, parentEl.node.children.length);
              parentEl.node.children.splice(idx, 0, elPath.node as any);
            }
          },
        });
        return; // done — don't process children of this element
      }

      // ── Other actions: find element by its own OID ────────────────
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
      }
    },
  });

  const output = generate(ast, { retainLines: true, compact: false });
  return output.code;
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
