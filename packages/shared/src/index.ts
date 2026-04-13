/**
 * @tnfronte/shared
 *
 * Shared types, interfaces, and protocol definitions for the TNFronte visual
 * development platform. Every sub-package imports from here — this is the
 * single source of truth for cross-module contracts.
 */

// ─── OID (Object Identifier) ──────────────────────────────────────────

/** Unique identifier for a DOM element within the editing session. */
export interface OID {
  /** Unique ID, e.g. "oid-a1b2c3d4" */
  id: string;
  /** Source file absolute path */
  filePath: string;
  /** AST node location in source file */
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  /** Enclosing component / module name */
  componentScope: string;
  /** Element tag name (e.g. "div", "Button") */
  tagName: string;
}

// ─── Framework Adapter ─────────────────────────────────────────────────

export type FrameworkType = 'react' | 'vue' | 'svelte' | 'html';

/** Result of injecting data-oid attributes into a source file. */
export interface InjectionResult {
  code: string;
  mappings: OID[];
  sourceMap?: unknown;
}

/** An editable property discovered on an AST node. */
export interface EditableProp {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'expression' | 'color' | 'enum';
  value: string;
  sourceLocation: { start: number; end: number };
}

/** Generic framework adapter contract. */
export interface FrameworkAdapter {
  name: FrameworkType;
  extensions: string[];
  injectOID(source: string, filePath: string): Promise<InjectionResult>;
  applyAction(source: string, oid: OID, action: CodeAction): Promise<string>;
  extractEditableProps(source: string, oid: OID): Promise<EditableProp[]>;
}

// ─── Code Actions ──────────────────────────────────────────────────────

export type CodeAction =
  | { type: 'MODIFY_STYLE'; prop: string; value: string }
  | { type: 'MODIFY_PROP'; prop: string; value: string }
  | { type: 'MODIFY_TEXT'; value: string }
  | { type: 'MOVE'; deltaX: number; deltaY: number; positionProp: string }
  | { type: 'RESIZE'; width?: number; height?: number }
  | { type: 'DELETE' }
  | { type: 'INSERT'; parentOID: string; index: number; code: string }
  | { type: 'REORDER'; parentOID: string; fromIndex: number; toIndex: number };

// ─── Communication Protocol (Bridge ↔ Editor) ─────────────────────────

/** Bridge → Editor messages */
export type BridgeToEditorMessage =
  | { type: 'ELEMENT_SELECTED'; oid: string; rect: DOMRectLike }
  | { type: 'ELEMENT_HOVERED'; oid: string; rect: DOMRectLike }
  | { type: 'DRAG_START'; oid: string; startX: number; startY: number }
  | { type: 'DRAG_MOVE'; oid: string; deltaX: number; deltaY: number }
  | { type: 'DRAG_END'; oid: string; finalX: number; finalY: number }
  | { type: 'ELEMENT_DBLCLICK'; oid: string }
  | { type: 'BRIDGE_READY' }
  | { type: 'DOM_UPDATED'; oids: string[] }
  | { type: 'TEXT_EDIT_COMPLETE'; oid: string; newText: string };

/** Editor → Bridge messages */
export type EditorToBridgeMessage =
  | { type: 'HIGHLIGHT_ELEMENT'; oid: string }
  | { type: 'UNHIGHLIGHT_ALL' }
  | { type: 'SET_SELECTION'; oid: string | null }
  | { type: 'APPLY_PREVIEW_STYLE'; oid: string; styles: Record<string, string> }
  | { type: 'START_TEXT_EDIT'; oid: string }
  | { type: 'SCROLL_TO_ELEMENT'; oid: string }
  | { type: 'REQUEST_DOM_SNAPSHOT' };

/** Unified message envelope for postMessage communication */
export interface MessageEnvelope {
  channel: 'tnfronte-bridge';
  version: 1;
  direction: 'bridge→editor' | 'editor→bridge';
  payload: BridgeToEditorMessage | EditorToBridgeMessage;
  timestamp: number;
}

// ─── Utility Types ─────────────────────────────────────────────────────

export interface DOMRectLike {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Style source analysis result */
export type StyleSourceType = 'inline' | 'class-css' | 'css-module' | 'tailwind' | 'inherited';

export interface StyleSource {
  type: StyleSourceType;
  source: string;
  specificity: number;
}

// ─── WebSocket Protocol ────────────────────────────────────────────────

/** Layer info sent to the editor UI */
export interface LayerInfo {
  oid: string;
  tagName: string;
  component: string;
  filePath: string;
  line: number;
}

/** Client → Server WebSocket message */
export interface ClientMessage {
  kind: 'action';
  oidId: string;
  action: CodeAction;
}

/** Server → Client WebSocket message */
export type ServerMessage =
  | { kind: 'action-result'; success: boolean; filePath: string; code?: string }
  | { kind: 'layers'; layers: LayerInfo[] }
  | { kind: 'file-changed'; filePath: string }
  | { kind: 'error'; message: string }
  | { kind: 'connected'; message: string };
