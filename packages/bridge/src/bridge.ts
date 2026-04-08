/**
 * Bridge — runtime communication layer injected into the user project iframe.
 *
 * Responsibilities:
 *  1. Capture mouse events (click, hover, drag, dblclick) on [data-oid] elements
 *  2. Forward actions to Editor UI via window.parent.postMessage
 *  3. Receive commands from Editor (highlight, style preview, text edit)
 *  4. Notify Editor of DOM updates after HMR
 */

import type {
  MessageEnvelope,
  BridgeToEditorMessage,
  EditorToBridgeMessage,
  DOMRectLike,
} from '@tnfronte/shared';

function toDOMRectLike(rect: DOMRect): DOMRectLike {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
  };
}

export class Bridge {
  private targetOrigin = '*';
  private selectedOID: string | null = null;
  private dragState: { oid: string; startX: number; startY: number } | null = null;

  constructor() {
    this.setupListeners();
    this.notifyReady();
  }

  // ─── Outbound ──────────────────────────────────────────────────────

  private send(payload: BridgeToEditorMessage) {
    const envelope: MessageEnvelope = {
      channel: 'tnfronte-bridge',
      version: 1,
      direction: 'bridge→editor',
      payload,
      timestamp: Date.now(),
    };
    window.parent.postMessage(envelope, this.targetOrigin);
  }

  private notifyReady() {
    this.send({ type: 'BRIDGE_READY' });
  }

  // ─── Inbound ───────────────────────────────────────────────────────

  private handleEditorMessage(msg: EditorToBridgeMessage) {
    switch (msg.type) {
      case 'HIGHLIGHT_ELEMENT':
        this.highlightElement(msg.oid);
        break;
      case 'UNHIGHLIGHT_ALL':
        document
          .querySelectorAll('.__tnfronte_highlight')
          .forEach((el) => el.classList.remove('__tnfronte_highlight'));
        break;
      case 'SET_SELECTION':
        this.setSelection(msg.oid);
        break;
      case 'APPLY_PREVIEW_STYLE': {
        const el = document.querySelector(
          `[data-oid="${msg.oid}"]`,
        ) as HTMLElement | null;
        if (el) Object.assign(el.style, msg.styles);
        break;
      }
      case 'START_TEXT_EDIT':
        this.startInlineEdit(msg.oid);
        break;
      case 'SCROLL_TO_ELEMENT': {
        const el = document.querySelector(`[data-oid="${msg.oid}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;
      }
      case 'REQUEST_DOM_SNAPSHOT':
        // TODO: serialize DOM tree with OIDs and send back
        break;
    }
  }

  // ─── Event Listeners ───────────────────────────────────────────────

  private setupListeners() {
    // Hover
    document.addEventListener('mouseover', (e) => {
      const oid = this.getOID(e.target as HTMLElement);
      if (oid && oid !== this.selectedOID) {
        const el = e.target as HTMLElement;
        this.send({ type: 'ELEMENT_HOVERED', oid, rect: toDOMRectLike(el.getBoundingClientRect()) });
      }
    });

    // Click → Select
    document.addEventListener(
      'click',
      (e) => {
        if (!(window as any).__TNFRONTE_EDITING__) return;
        e.preventDefault();
        e.stopPropagation();

        const oid = this.getOID(e.target as HTMLElement);
        if (oid) {
          this.selectedOID = oid;
          const el = e.target as HTMLElement;
          this.send({ type: 'ELEMENT_SELECTED', oid, rect: toDOMRectLike(el.getBoundingClientRect()) });
        }
      },
      true, // capture phase — fires before user code
    );

    // Drag
    document.addEventListener('mousedown', (e) => {
      const oid = this.getOID(e.target as HTMLElement);
      if (oid && this.selectedOID === oid) {
        this.dragState = { oid, startX: e.clientX, startY: e.clientY };
        this.send({ type: 'DRAG_START', oid, startX: e.clientX, startY: e.clientY });
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.dragState) return;
      this.send({
        type: 'DRAG_MOVE',
        oid: this.dragState.oid,
        deltaX: e.clientX - this.dragState.startX,
        deltaY: e.clientY - this.dragState.startY,
      });
    });

    document.addEventListener('mouseup', () => {
      if (!this.dragState) return;
      this.send({ type: 'DRAG_END', oid: this.dragState.oid, finalX: 0, finalY: 0 });
      this.dragState = null;
    });

    // Double-click → text edit
    document.addEventListener('dblclick', (e) => {
      const oid = this.getOID(e.target as HTMLElement);
      if (oid) this.send({ type: 'ELEMENT_DBLCLICK', oid });
    });

    // Receive Editor commands
    window.addEventListener('message', (e) => {
      const data = e.data as MessageEnvelope;
      if (data?.channel !== 'tnfronte-bridge') return;
      if (data.direction !== 'editor→bridge') return;
      this.handleEditorMessage(data.payload as EditorToBridgeMessage);
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────────

  private getOID(el: HTMLElement): string | null {
    const target = el.closest('[data-oid]');
    return target?.getAttribute('data-oid') ?? null;
  }

  private highlightElement(oid: string) {
    document
      .querySelectorAll('.__tnfronte_highlight')
      .forEach((el) => el.classList.remove('__tnfronte_highlight'));
    document.querySelector(`[data-oid="${oid}"]`)?.classList.add('__tnfronte_highlight');
  }

  private setSelection(oid: string | null) {
    this.selectedOID = oid;
    if (oid) this.highlightElement(oid);
  }

  private startInlineEdit(oid: string) {
    const el = document.querySelector(`[data-oid="${oid}"]`) as HTMLElement | null;
    if (!el) return;
    el.contentEditable = 'true';
    el.focus();
    const onDone = () => {
      el.contentEditable = 'false';
      this.send({ type: 'TEXT_EDIT_COMPLETE', oid, newText: el.innerText });
    };
    el.addEventListener('blur', onDone, { once: true });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onDone();
      }
    });
  }
}

// Auto-initialise when loaded in iframe
new Bridge();
