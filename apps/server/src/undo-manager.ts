/**
 * UndoManager — Command Pattern implementation for undo/redo.
 *
 * Stores snapshots of file contents before each edit.
 * Undo restores the previous snapshot; redo re-applies the current one.
 */
export interface UndoEntry {
  filePath: string;
  oldContent: string;
  description: string;
}

import * as fs from 'fs/promises';

export class UndoManager {
  private undoStack: UndoEntry[] = [];
  private redoStack: UndoEntry[] = [];
  private maxStackSize = 100;

  /** Push a snapshot before an edit is applied. */
  push(entry: UndoEntry) {
    this.undoStack.push(entry);
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift();
    }
    // New edit clears the redo stack
    this.redoStack = [];
  }

  /** Undo the last edit — write old content back to file. */
  async undo(): Promise<{ success: boolean; filePath: string; message: string }> {
    const entry = this.undoStack.pop();
    if (!entry) {
      return { success: false, filePath: '', message: 'Nothing to undo' };
    }

    try {
      // Save current content for redo
      const currentContent = await fs.readFile(entry.filePath, 'utf-8');
      this.redoStack.push({
        filePath: entry.filePath,
        oldContent: currentContent,
        description: `redo: ${entry.description}`,
      });

      // Restore old content
      await fs.writeFile(entry.filePath, entry.oldContent, 'utf-8');

      return {
        success: true,
        filePath: entry.filePath,
        message: `Undo: ${entry.description}`,
      };
    } catch (err: any) {
      // Put it back on undo stack if write fails
      this.undoStack.push(entry);
      return { success: false, filePath: entry.filePath, message: err.message };
    }
  }

  /** Redo the last undone edit. */
  async redo(): Promise<{ success: boolean; filePath: string; message: string }> {
    const entry = this.redoStack.pop();
    if (!entry) {
      return { success: false, filePath: '', message: 'Nothing to redo' };
    }

    try {
      const currentContent = await fs.readFile(entry.filePath, 'utf-8');
      this.undoStack.push({
        filePath: entry.filePath,
        oldContent: currentContent,
        description: `undo: ${entry.description}`,
      });

      await fs.writeFile(entry.filePath, entry.oldContent, 'utf-8');

      return {
        success: true,
        filePath: entry.filePath,
        message: `Redo: ${entry.description}`,
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
