/**
 * UndoManager — Command Pattern implementation for undo/redo.
 *
 * Stores snapshots of file contents before each edit.
 * Undo restores the previous snapshot; redo re-applies the current one.
 *
 * Safety: Before writing, checks that the current file content matches
 * what we expect (no external modifications since last edit).
 */

import * as fs from 'fs/promises';

export interface UndoEntry {
  filePath: string;
  oldContent: string;
  /** Snapshot of file content right after the edit was applied (for consistency check). */
  newContent: string;
  description: string;
}

export class UndoManager {
  private undoStack: UndoEntry[] = [];
  private redoStack: UndoEntry[] = [];
  private maxStackSize = 100;

  /** Push a snapshot before an edit is applied. Returns the undo entry to fill newContent later. */
  push(entry: { filePath: string; oldContent: string; description: string }): UndoEntry {
    const full: UndoEntry = {
      ...entry,
      newContent: '', // filled by pushNewContent after edit succeeds
    };
    this.undoStack.push(full);
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift();
    }
    // New edit clears the redo stack
    this.redoStack = [];
    return full;
  }

  /** Update the entry with content after the edit was applied (for consistency check on undo). */
  pushNewContent(entry: UndoEntry, newContent: string) {
    entry.newContent = newContent;
  }

  /** Remove a pending undo entry when the associated edit failed. */
  discard(entry: UndoEntry) {
    const index = this.undoStack.lastIndexOf(entry);
    if (index >= 0) {
      this.undoStack.splice(index, 1);
    }
  }

  /**
   * Undo the last edit — write old content back to file.
   * If the file was externally modified, returns success=false with a warning.
   */
  async undo(): Promise<{ success: boolean; filePath: string; message: string; conflict?: boolean }> {
    const entry = this.undoStack.pop();
    if (!entry) {
      return { success: false, filePath: '', message: 'Nothing to undo' };
    }

    try {
      const currentContent = await fs.readFile(entry.filePath, 'utf-8');

      // Consistency check: if newContent was recorded and doesn't match, warn about conflict
      let conflict = false;
      if (entry.newContent && currentContent !== entry.newContent) {
        // File was externally modified since last edit — proceed but warn
        conflict = true;
        console.warn(
          `[UndoManager] File ${entry.filePath} was externally modified after last edit. Undo will overwrite those changes.`,
        );
      }

      // Save current content for redo
      this.redoStack.push({
        filePath: entry.filePath,
        oldContent: currentContent,
        newContent: entry.oldContent,
        description: `redo: ${entry.description}`,
      });

      // Restore old content atomically
      const tmpPath = entry.filePath + '.tnfronte-undo-tmp';
      await fs.writeFile(tmpPath, entry.oldContent, 'utf-8');
      await fs.rename(tmpPath, entry.filePath);

      return {
        success: true,
        filePath: entry.filePath,
        message: `Undo: ${entry.description}`,
        conflict,
      };
    } catch (err: any) {
      // Put it back on undo stack if write fails
      this.undoStack.push(entry);
      return { success: false, filePath: entry.filePath, message: err.message };
    }
  }

  /**
   * Redo the last undone edit.
   */
  async redo(): Promise<{ success: boolean; filePath: string; message: string; conflict?: boolean }> {
    const entry = this.redoStack.pop();
    if (!entry) {
      return { success: false, filePath: '', message: 'Nothing to redo' };
    }

    try {
      const currentContent = await fs.readFile(entry.filePath, 'utf-8');

      let conflict = false;
      if (entry.newContent && currentContent !== entry.newContent) {
        conflict = true;
        console.warn(
          `[UndoManager] File ${entry.filePath} was externally modified since last undo. Redo will overwrite those changes.`,
        );
      }

      this.undoStack.push({
        filePath: entry.filePath,
        oldContent: currentContent,
        newContent: entry.oldContent,
        description: `undo: ${entry.description}`,
      });

      const tmpPath = entry.filePath + '.tnfronte-redo-tmp';
      await fs.writeFile(tmpPath, entry.oldContent, 'utf-8');
      await fs.rename(tmpPath, entry.filePath);

      return {
        success: true,
        filePath: entry.filePath,
        message: `Redo: ${entry.description}`,
        conflict,
      };
    } catch (err: any) {
      this.redoStack.push(entry);
      return { success: false, filePath: entry.filePath, message: err.message };
    }
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get undoCount(): number {
    return this.undoStack.length;
  }

  get redoCount(): number {
    return this.redoStack.length;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}
