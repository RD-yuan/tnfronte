import type { OID } from '@tnfronte/shared';

/**
 * OIDIndex maintains two maps for fast lookup:
 *
 *   1. byId   — oid string → OID record  (used by code-mod to locate nodes)
 *   2. byFile — filePath → OID[]          (used to clear stale mappings on re-inject)
 */
export class OIDIndex {
  private byId = new Map<string, OID>();
  private byFile = new Map<string, OID[]>();

  /** Replace all mappings for a single file (called after each transform). */
  updateMappings(filePath: string, mappings: OID[]) {
    // Remove old mappings for this file
    const old = this.byFile.get(filePath);
    if (old) {
      for (const m of old) this.byId.delete(m.id);
    }

    // Insert new mappings
    this.byFile.set(filePath, mappings);
    for (const m of mappings) {
      this.byId.set(m.id, m);
    }
  }

  /** Look up a single OID by its id string. */
  getById(id: string): OID | undefined {
    return this.byId.get(id);
  }

  /** Get all mappings for a file. */
  getByFile(filePath: string): OID[] {
    return this.byFile.get(filePath) ?? [];
  }

  /** Get every mapping (for layer tree / snapshot). */
  getAll(): OID[] {
    return Array.from(this.byId.values());
  }

  /** Get all known file paths. */
  getFiles(): string[] {
    return Array.from(this.byFile.keys());
  }

  /** Remove all mappings for a file. */
  removeFile(filePath: string) {
    const old = this.byFile.get(filePath);
    if (old) {
      for (const m of old) this.byId.delete(m.id);
    }
    this.byFile.delete(filePath);
  }

  /** Clear everything. */
  clear() {
    this.byId.clear();
    this.byFile.clear();
  }

  /** Total number of tracked OIDs. */
  get size(): number {
    return this.byId.size;
  }
}
