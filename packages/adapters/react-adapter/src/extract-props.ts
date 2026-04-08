/**
 * extract-props.ts
 *
 * Given an OID, walks the AST to find the matching JSX element and
 * extracts all editable props (className, style properties, text children,
 * custom attributes).
 */

import * as recast from 'recast';
import { parse as babelParse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

import type { OID, EditableProp } from '@tnfronte/shared';

const tsxParser = {
  parse(source: string) {
    return babelParse(source, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy', 'importMeta'],
    });
  },
};

export function extractProps(source: string, oid: OID): EditableProp[] {
  const ast = recast.parse(source, { parser: tsxParser });
  const props: EditableProp[] = [];

  traverse(ast, {
    JSXOpeningElement(path) {
      const hasOID = path.node.attributes.some(
        (attr) =>
          t.isJSXAttribute(attr) &&
          t.isJSXIdentifier(attr.name) &&
          attr.name.name === 'data-oid' &&
          t.isStringLiteral(attr.value) &&
          attr.value.value === oid.id,
      );
      if (!hasOID) return;

      for (const attr of path.node.attributes) {
        if (!t.isJSXAttribute(attr)) continue;
        if (t.isJSXIdentifier(attr.name) && attr.name.name === 'data-oid') continue;

        const name = (attr.name as t.JSXIdentifier).name;

        if (name === 'style' && t.isJSXExpressionContainer(attr.value)) {
          const expr = attr.value.expression;
          if (t.isObjectExpression(expr)) {
            for (const prop of expr.properties) {
              if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
                const val =
                  t.isStringLiteral(prop.value)
                    ? prop.value.value
                    : t.isNumericLiteral(prop.value)
                      ? String(prop.value.value)
                      : recast.print(prop.value).code;
                props.push({
                  name: `style.${prop.key.name}`,
                  type: inferType(prop.key.name, val),
                  value: val,
                  sourceLocation: {
                    start: (prop.loc?.start.index ?? 0) as number,
                    end: (prop.loc?.end.index ?? 0) as number,
                  },
                });
              }
            }
          }
        } else if (name === 'className') {
          props.push({
            name: 'className',
            type: 'string',
            value: t.isStringLiteral(attr.value) ? attr.value.value : '',
            sourceLocation: { start: 0, end: 0 },
          });
        } else {
          props.push({
            name,
            type: 'string',
            value: t.isStringLiteral(attr.value)
              ? attr.value.value
              : t.isJSXExpressionContainer(attr.value)
                ? recast.print(attr.value).code
                : '',
            sourceLocation: { start: 0, end: 0 },
          });
        }
      }

      // Extract text children
      const parent = path.parent;
      if (t.isJSXElement(parent) && parent.children) {
        for (const child of parent.children) {
          if (t.isJSXText(child) && child.value.trim()) {
            props.push({
              name: 'children',
              type: 'string',
              value: child.value,
              sourceLocation: { start: 0, end: 0 },
            });
          }
        }
      }
    },
  });

  return props;
}

function inferType(propName: string, value: string): EditableProp['type'] {
  if (propName.match(/color|background|border|Color$/)) return 'color';
  if (propName.match(/width|height|size|margin|padding|top|left|right|bottom/))
    return 'string';
  return 'string';
}
