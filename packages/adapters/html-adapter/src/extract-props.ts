import type { EditableProp, OID } from '@tnfronte/shared';

import {
  collectInlineStyleProps,
  findElementByOID,
  getAttributeLocation,
  getDirectTextContent,
  inferEditableType,
  parseHtmlSource,
} from './utils';

export function extractProps(source: string, oid: OID): EditableProp[] {
  const root = parseHtmlSource(source);
  const element = findElementByOID(root, oid);
  if (!element) {
    return [];
  }

  const props: EditableProp[] = [];

  for (const attr of element.attrs) {
    if (attr.name === 'data-oid') continue;

    if (attr.name === 'style') {
      props.push(...collectInlineStyleProps(element));
      continue;
    }

    const location = getAttributeLocation(element, attr.name);
    const isBoolean = attr.value === '';
    const value = isBoolean ? 'true' : attr.value;

    props.push({
      name: attr.name,
      type: isBoolean ? 'boolean' : inferEditableType(attr.name, value),
      value,
      sourceLocation: {
        start: location?.startOffset ?? 0,
        end: location?.endOffset ?? 0,
      },
    });
  }

  const textContent = getDirectTextContent(element);
  if (textContent) {
    const location = element.childNodes.find((child) => child.nodeName === '#text')?.sourceCodeLocation;
    props.push({
      name: 'children',
      type: 'string',
      value: textContent,
      sourceLocation: {
        start: location?.startOffset ?? 0,
        end: location?.endOffset ?? 0,
      },
    });
  }

  return props;
}
