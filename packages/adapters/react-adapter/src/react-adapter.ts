import type { FrameworkAdapter, InjectionResult, OID, CodeAction, EditableProp } from '@tnfronte/shared';

import { injectOID } from './inject-oid';
import { applyAction } from './apply-action';
import { extractProps } from './extract-props';

export class ReactAdapter implements FrameworkAdapter {
  name = 'react' as const;
  extensions = ['.tsx', '.jsx'];

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
