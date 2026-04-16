import generate from '@babel/generator';
import { parse as babelParse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

import type { EditableProp, OID } from '@tnfronte/shared';

export function extractProps(source: string, oid: OID): EditableProp[] {
  const ast = babelParse(source, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript', 'decorators-legacy', 'importMeta'],
  });
  const props: EditableProp[] = [];

  traverse(ast, {
    JSXOpeningElement(path) {
      if (!matchesOID(path, oid)) return;

      for (const attr of path.node.attributes) {
        if (!t.isJSXAttribute(attr)) continue;
        if (!t.isJSXIdentifier(attr.name)) continue;
        if (attr.name.name === 'data-oid') continue;

        if (attr.name.name === 'style') {
          props.push(...readStyleProps(attr));
          continue;
        }

        const { type, value } = readAttributeValue(attr);
        props.push({
          name: attr.name.name,
          type: attr.name.name === 'className' ? 'string' : type,
          value,
          sourceLocation: {
            start: attr.loc?.start.column ?? 0,
            end: attr.loc?.end.column ?? 0,
          },
        });
      }

      const parent = path.parent;
      if (t.isJSXElement(parent) && parent.children) {
        for (const child of parent.children) {
          if (t.isJSXText(child) && child.value.trim()) {
            props.push({
              name: 'children',
              type: 'string',
              value: child.value.trim(),
              sourceLocation: {
                start: child.loc?.start.column ?? 0,
                end: child.loc?.end.column ?? 0,
              },
            });
            break;
          }
        }
      }
    },
  });

  return props;
}

function matchesOID(path: any, oid: OID): boolean {
  const loc = path.node.loc?.start;
  if (loc && loc.line === oid.startLine && loc.column === oid.startCol) {
    return true;
  }

  const attrs: t.JSXAttribute[] = path.node.attributes;
  return attrs.some(
    (attr) =>
      t.isJSXAttribute(attr) &&
      t.isJSXIdentifier(attr.name) &&
      attr.name.name === 'data-oid' &&
      t.isStringLiteral(attr.value) &&
      attr.value.value === oid.id,
  );
}

function readAttributeValue(attr: t.JSXAttribute): Pick<EditableProp, 'type' | 'value'> {
  if (attr.value == null) {
    return { type: 'boolean', value: 'true' };
  }

  if (t.isStringLiteral(attr.value)) {
    return {
      type: inferType(attr.name, attr.value.value),
      value: attr.value.value,
    };
  }

  if (!t.isJSXExpressionContainer(attr.value)) {
    return { type: 'string', value: '' };
  }

  const expr = attr.value.expression;

  if (t.isStringLiteral(expr)) {
    return { type: inferType(attr.name, expr.value), value: expr.value };
  }

  if (t.isNumericLiteral(expr)) {
    return { type: 'number', value: String(expr.value) };
  }

  if (t.isBooleanLiteral(expr)) {
    return { type: 'boolean', value: String(expr.value) };
  }

  return {
    type: 'expression',
    value: generate(expr).code,
  };
}

function readStyleProps(attr: t.JSXAttribute): EditableProp[] {
  if (!t.isJSXExpressionContainer(attr.value)) {
    return [];
  }

  const expr = attr.value.expression;
  if (!t.isObjectExpression(expr)) {
    return [
      {
        name: 'style',
        type: 'expression',
        value: generate(expr).code,
        sourceLocation: {
          start: attr.loc?.start.column ?? 0,
          end: attr.loc?.end.column ?? 0,
        },
      },
    ];
  }

  const props: EditableProp[] = [];
  for (const property of expr.properties) {
    if (!t.isObjectProperty(property)) continue;

    const name = readStylePropName(property.key);
    if (!name) continue;

    const { type, value } = readStyleValue(name, property.value);
    props.push({
      name: `style.${name}`,
      type,
      value,
      sourceLocation: {
        start: property.loc?.start.column ?? 0,
        end: property.loc?.end.column ?? 0,
      },
    });
  }

  return props;
}

function readStylePropName(key: t.Expression | t.Identifier | t.PrivateName): string | null {
  if (t.isIdentifier(key)) return key.name;
  if (t.isStringLiteral(key)) return key.value;
  return null;
}

function readStyleValue(propName: string, value: t.Expression | t.PatternLike): Pick<EditableProp, 'type' | 'value'> {
  if (t.isStringLiteral(value)) {
    return { type: inferType(t.jsxIdentifier(propName), value.value), value: value.value };
  }

  if (t.isNumericLiteral(value)) {
    return { type: 'number', value: String(value.value) };
  }

  if (t.isBooleanLiteral(value)) {
    return { type: 'boolean', value: String(value.value) };
  }

  return {
    type: 'expression',
    value: generate(value).code,
  };
}

function inferType(name: t.JSXIdentifier | t.JSXNamespacedName, value: string): EditableProp['type'] {
  if (!t.isJSXIdentifier(name)) return 'string';
  if (name.name.match(/color|background|border|Color$/)) return 'color';
  if (value === 'true' || value === 'false') return 'boolean';
  return 'string';
}
