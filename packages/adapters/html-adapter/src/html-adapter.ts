import type { CodeAction, EditableProp, FrameworkAdapter, InjectionResult, OID } from '@tnfronte/shared';

import { applyAction } from './apply-action';
import { extractProps } from './extract-props';
import { injectOID } from './inject-oid';

export class HtmlAdapter implements FrameworkAdapter {
  name = 'html' as const;
  extensions = ['.html', '.htm'];

  async injectOID(source: string, filePath: string): Promise<InjectionResult> {
    return injectOID(source, filePath);
  }

  async applyAction(source: string, oid: OID, action: CodeAction): Promise<string> {
    return applyAction(source, oid, action);
  }

  async extractEditableProps(source: string, oid: OID): Promise<EditableProp[]> {
    return extractProps(source, oid);
  }
}
