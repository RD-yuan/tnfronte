import { createHash } from 'crypto';
import * as path from 'path';
import {
  parse,
  parseFragment,
  serialize,
  type DefaultTreeAdapterTypes,
} from 'parse5';

import type { EditableProp, OID } from '@tnfronte/shared';

export type HtmlRoot = DefaultTreeAdapterTypes.Document | DefaultTreeAdapterTypes.DocumentFragment;
export type HtmlNode = DefaultTreeAdapterTypes.Node;
export type HtmlParentNode = DefaultTreeAdapterTypes.ParentNode;
export type HtmlElement = DefaultTreeAdapterTypes.Element;
export type HtmlTemplate = DefaultTreeAdapterTypes.Template;
export type HtmlTextNode = DefaultTreeAdapterTypes.TextNode;

interface HtmlSourceLocation {
  startLine: number;
  startCol: number;
  startOffset: number;
  endLine: number;
  endCol: number;
  endOffset: number;
  attrs?: Record<string, HtmlSourceLocation>;
}

const DOCUMENT_RE = /^\s*(<!doctype|<html[\s>])/i;
const SKIPPED_TAGS = new Set([
  'html',
  'head',
  'meta',
  'title',
  'script',
  'style',
  'link',
  'noscript',
  'base',
  'template',
]);

export function parseHtmlSource(source: string): HtmlRoot {
  const options = { sourceCodeLocationInfo: true };
  return DOCUMENT_RE.test(source) ? parse(source, options) : parseFragment(source, options);
}

export function serializeHtmlSource(root: HtmlRoot): string {
  return serialize(root);
}

export function makeOID(raw: string): string {
  return 'oid-' + createHash('md5').update(raw).digest('hex').slice(0, 10);
}

export function getHtmlScope(filePath: string): string {
  return path.basename(filePath);
}

export function isElementNode(node: HtmlNode | null | undefined): node is HtmlElement {
  return Boolean(node && typeof node === 'object' && 'tagName' in node && 'attrs' in node);
}

export function isTemplateElement(node: HtmlNode | null | undefined): node is HtmlTemplate {
  return isElementNode(node) && node.tagName === 'template' && 'content' in node;
}

export function isTextNode(node: HtmlNode | null | undefined): node is HtmlTextNode {
  return Boolean(node && typeof node === 'object' && node.nodeName === '#text' && 'value' in node);
}

export function walkElements(root: HtmlParentNode, visit: (element: HtmlElement) => void) {
  for (const child of root.childNodes) {
    if (!isElementNode(child)) continue;

    visit(child);
    walkElements(child, visit);

    if (isTemplateElement(child)) {
      walkElements(child.content, visit);
    }
  }
}

export function findElementByOID(root: HtmlParentNode, oid: OID): HtmlElement | null {
  let match: HtmlElement | null = null;

  walkElements(root, (element) => {
    if (!match && matchesOID(element, oid)) {
      match = element;
    }
  });

  return match;
}

export function matchesOID(element: HtmlElement, oid: OID): boolean {
  const existingId = getAttribute(element, 'data-oid');
  if (existingId === oid.id) {
    return true;
  }

  const location = getElementLocation(element);
  return Boolean(
    location &&
      location.startLine === oid.startLine &&
      location.startCol === oid.startCol,
  );
}

export function shouldTrackElement(element: HtmlElement): boolean {
  return !SKIPPED_TAGS.has(element.tagName.toLowerCase());
}

export function getElementLocation(element: HtmlElement): HtmlSourceLocation | null {
  const location = element.sourceCodeLocation as HtmlSourceLocation | null | undefined;
  if (!location) return null;

  return location;
}

export function getAttributeLocation(
  element: HtmlElement,
  name: string,
): HtmlSourceLocation | null {
  const location = getElementLocation(element);
  return location?.attrs?.[normalizeAttributeName(name)] ?? null;
}

export function getAttribute(element: HtmlElement, name: string): string | null {
  const normalizedName = normalizeAttributeName(name);
  const attr = element.attrs.find((candidate) => candidate.name === normalizedName);
  return attr?.value ?? null;
}

export function hasAttribute(element: HtmlElement, name: string): boolean {
  return getAttribute(element, name) != null;
}

export function setAttribute(element: HtmlElement, name: string, value: string) {
  const normalizedName = normalizeAttributeName(name);
  const existing = element.attrs.find((candidate) => candidate.name === normalizedName);
  if (existing) {
    existing.value = value;
    return;
  }

  element.attrs.push({ name: normalizedName, value });
}

export function removeAttribute(element: HtmlElement, name: string) {
  const normalizedName = normalizeAttributeName(name);
  const index = element.attrs.findIndex((candidate) => candidate.name === normalizedName);
  if (index >= 0) {
    element.attrs.splice(index, 1);
  }
}

export function normalizeAttributeName(name: string): string {
  return name === 'className' ? 'class' : name;
}

export function parseStyleAttribute(styleValue: string): Record<string, string> {
  const styles: Record<string, string> = {};

  for (const declaration of styleValue.split(';')) {
    const trimmed = declaration.trim();
    if (!trimmed) continue;

    const separatorIndex = trimmed.indexOf(':');
    if (separatorIndex < 0) continue;

    const rawName = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (!rawName) continue;

    styles[toCamelCase(rawName)] = rawValue;
  }

  return styles;
}

export function serializeStyleAttribute(styles: Record<string, string>): string {
  return Object.entries(styles)
    .filter(([, value]) => value.trim() !== '')
    .map(([name, value]) => `${toKebabCase(name)}: ${value}`)
    .join('; ');
}

export function setStyleProperty(element: HtmlElement, cssProp: string, value: string) {
  const propName = toCamelCase(cssProp);
  const styles = parseStyleAttribute(getAttribute(element, 'style') ?? '');

  if (value.trim() === '') {
    delete styles[propName];
  } else {
    styles[propName] = value.trim();
  }

  const serialized = serializeStyleAttribute(styles);
  if (serialized) {
    setAttribute(element, 'style', serialized);
    return;
  }

  removeAttribute(element, 'style');
}

export function collectInlineStyleProps(element: HtmlElement): EditableProp[] {
  const styleValue = getAttribute(element, 'style');
  if (!styleValue) return [];

  const location = getAttributeLocation(element, 'style');
  const styles = parseStyleAttribute(styleValue);

  return Object.entries(styles).map(([name, value]) => ({
    name: `style.${name}`,
    type: inferEditableType(name, value),
    value,
    sourceLocation: {
      start: location?.startOffset ?? 0,
      end: location?.endOffset ?? 0,
    },
  }));
}

export function getDirectTextContent(element: HtmlElement): string {
  return element.childNodes
    .filter(isTextNode)
    .map((child) => child.value.trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

export function setDirectTextContent(element: HtmlElement, value: string) {
  const textNodes = element.childNodes.filter(isTextNode);
  const primaryNode = textNodes.find((child) => child.value.trim()) ?? textNodes[0] ?? null;

  if (primaryNode) {
    primaryNode.value = value;

    for (const child of textNodes) {
      if (child === primaryNode) continue;
      removeNode(child);
    }
    return;
  }

  element.childNodes.unshift(createTextNode(value, element));
}

export function insertHtmlAt(element: HtmlElement, html: string, index: number) {
  const fragment = parseFragment(element, html, { sourceCodeLocationInfo: true });
  const insertionIndex = Math.max(0, Math.min(index, element.childNodes.length));

  fragment.childNodes.forEach((child, offset) => {
    (child as { parentNode: HtmlParentNode | null }).parentNode = element;
    element.childNodes.splice(insertionIndex + offset, 0, child);
  });
}

export function removeNode(node: HtmlNode) {
  if (!('parentNode' in node)) return;

  const parent = node.parentNode;
  if (!parent || !('childNodes' in parent)) return;

  const index = parent.childNodes.indexOf(node as DefaultTreeAdapterTypes.ChildNode);
  if (index >= 0) {
    parent.childNodes.splice(index, 1);
  }
}

export function inferEditableType(
  name: string,
  value: string,
): EditableProp['type'] {
  const lowerName = name.toLowerCase();
  if (lowerName.startsWith('on')) return 'expression';
  if (lowerName.includes('color') || lowerName.includes('background') || lowerName.includes('border')) {
    return 'color';
  }
  if (value === 'true' || value === 'false') return 'boolean';
  if (/^-?\d+(\.\d+)?$/.test(value)) return 'number';
  return 'string';
}

export function toCamelCase(value: string): string {
  return value.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
}

export function toKebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

function createTextNode(value: string, parentNode: HtmlElement): HtmlTextNode {
  return {
    nodeName: '#text',
    parentNode,
    value,
  };
}
