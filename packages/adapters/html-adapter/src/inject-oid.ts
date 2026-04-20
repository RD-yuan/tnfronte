import type { InjectionResult, OID } from '@tnfronte/shared';

import {
  getAttribute,
  getElementLocation,
  getHtmlScope,
  isElementNode,
  isTemplateElement,
  makeOID,
  parseHtmlSource,
  serializeHtmlSource,
  setAttribute,
  shouldTrackElement,
  type HtmlParentNode,
} from './utils';

export function injectOID(source: string, filePath: string): InjectionResult {
  const root = parseHtmlSource(source);
  const mappings: OID[] = [];
  const componentScope = getHtmlScope(filePath);

  visit(root, []);

  return {
    code: serializeHtmlSource(root),
    mappings,
  };

  function visit(node: HtmlParentNode, trail: string[]) {
    let childIndex = 0;

    for (const child of node.childNodes) {
      if (!isElementNode(child)) continue;

      const segment = `${child.tagName}[${childIndex}]`;
      childIndex += 1;
      const nextTrail = [...trail, segment];

      if (shouldTrackElement(child)) {
        const location = getElementLocation(child);
        if (location) {
          const existingId = getAttribute(child, 'data-oid');
          const id = existingId ?? makeOID(`${filePath}:${nextTrail.join('/')}`);

          mappings.push({
            id,
            filePath,
            startLine: location.startLine,
            startCol: location.startCol,
            endLine: location.endLine,
            endCol: location.endCol,
            componentScope,
            tagName: child.tagName,
          });

          if (!existingId) {
            setAttribute(child, 'data-oid', id);
          }
        }
      }

      visit(child, nextTrail);

      if (isTemplateElement(child)) {
        visit(child.content, [...nextTrail, 'content']);
      }
    }
  }
}
