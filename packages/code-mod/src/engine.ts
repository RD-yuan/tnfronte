import * as fs from 'fs/promises';
import * as path from 'path';
import * as prettier from 'prettier';

import type { CodeAction, FrameworkAdapter, OID } from '@tnfronte/shared';
import { OIDIndex } from '@tnfronte/oid-index';

export class CodeModEngine {
  private adapters = new Map<string, FrameworkAdapter>();
  private oidIndex: OIDIndex;

  constructor(oidIndex: OIDIndex) {
    this.oidIndex = oidIndex;
  }

  /** Register a framework adapter. */
  registerAdapter(adapter: FrameworkAdapter) {
    this.adapters.set(adapter.name, adapter);
  }

  /**
   * Apply a CodeAction to the source file associated with the given OID.
   *
   * @returns The formatted source code after modification.
   * The caller is responsible for writing it to disk.
   */
  async apply(oidId: string, action: CodeAction): Promise<{
    filePath: string;
    code: string;
    success: boolean;
  }> {
    const oid = this.oidIndex.getById(oidId);
    if (!oid) {
      return { filePath: '', code: '', success: false };
    }

    // Determine which adapter to use based on file extension
    const adapter = this.findAdapter(oid.filePath);
    if (!adapter) {
      return { filePath: oid.filePath, code: '', success: false };
    }

    // Read current file content
    const source = await fs.readFile(oid.filePath, 'utf-8');

    // Apply the action via the adapter
    let modified: string;
    try {
      modified = await adapter.applyAction(source, oid, action);
    } catch (err) {
      console.error(`[CodeModEngine] applyAction failed:`, err);
      return { filePath: oid.filePath, code: source, success: false };
    }

    // Format with Prettier (using project's config if available)
    const formatted = await this.format(modified, oid.filePath);

    return { filePath: oid.filePath, code: formatted, success: true };
  }

  /**
   * Apply + write to disk in one step.
   */
  async applyAndWrite(oidId: string, action: CodeAction): Promise<{
    filePath: string;
    success: boolean;
  }> {
    const result = await this.apply(oidId, action);
    if (!result.success) return { filePath: result.filePath, success: false };

    // Atomic write: tmp → rename
    const tmpPath = result.filePath + '.tnfronte-tmp';
    await fs.writeFile(tmpPath, result.code, 'utf-8');
    await fs.rename(tmpPath, result.filePath);

    return { filePath: result.filePath, success: true };
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  private findAdapter(filePath: string): FrameworkAdapter | undefined {
    const ext = path.extname(filePath);
    for (const adapter of this.adapters.values()) {
      if (adapter.extensions.includes(ext)) return adapter;
    }
    return undefined;
  }

  private async format(code: string, filePath: string): Promise<string> {
    try {
      const config = await prettier.resolveConfig(filePath);
      return await prettier.format(code, {
        filepath: filePath,
        ...config,
      });
    } catch {
      // If Prettier fails (unsupported file type etc.), return as-is
      return code;
    }
  }
}
