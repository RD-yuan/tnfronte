import type { CodeAction, OID } from '@tnfronte/shared';

import {
  findElementByOID,
  type HtmlElement,
  insertHtmlAt,
  parseHtmlSource,
  removeAttribute,
  removeNode,
  serializeHtmlSource,
  setAttribute,
  setDirectTextContent,
  setStyleProperty,
} from './utils';

export function applyAction(source: string, oid: OID, action: CodeAction): string {
  const root = parseHtmlSource(source);

  if (action.type === 'REORDER') {
    throw new Error('REORDER action is not yet implemented for HTML');
  }

  const target = findElementByOID(root, oid);
  if (!target) {
    throw new Error(`Element not found for OID ${oid.id}`);
  }

  switch (action.type) {
    case 'MODIFY_STYLE':
      setStyleProperty(target, action.prop, action.value);
      break;

    case 'MODIFY_PROP':
      modifyProp(target, action.prop, action.value);
      break;

    case 'MODIFY_TEXT':
      setDirectTextContent(target, action.value);
      break;

    case 'MOVE': {
      const delta =
        /top|bottom|y/i.test(action.positionProp) ? action.deltaY : action.deltaX;
      setStyleProperty(target, action.positionProp, `${delta}px`);
      break;
    }

    case 'RESIZE':
      if (action.width != null) {
        setStyleProperty(target, 'width', `${action.width}px`);
      }
      if (action.height != null) {
        setStyleProperty(target, 'height', `${action.height}px`);
      }
      break;

    case 'DELETE':
      removeNode(target);
      break;

    case 'INSERT':
      if (action.parentOID !== oid.id) {
        throw new Error('INSERT action must target the parent OID');
      }
      insertHtmlAt(target, action.code, action.index);
      break;
  }

  return serializeHtmlSource(root);
}

function modifyProp(
  element: HtmlElement,
  prop: string,
  value: string | number | boolean,
) {
  if (prop === 'children') {
    setDirectTextContent(element, String(value));
    return;
  }

  if (typeof value === 'boolean') {
    if (value) {
      setAttribute(element, prop, '');
    } else {
      removeAttribute(element, prop);
    }
    return;
  }

  setAttribute(element, prop, String(value));
}
