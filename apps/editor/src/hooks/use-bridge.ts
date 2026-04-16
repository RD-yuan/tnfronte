import { useCallback, useEffect, useRef } from 'react';
import type {
  BridgeToEditorMessage,
  CodeAction,
  EditorToBridgeMessage,
  MessageEnvelope,
} from '@tnfronte/shared';
import { API } from '../config';
import { useEditorStore } from '../store/editor-store';

/**
 * Handles postMessage communication with the Bridge script running
 * inside the user-project iframe.
 */
export function useBridge(sendAction: (oidId: string, action: CodeAction) => void) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { selectElement, setHoveredOID, setLayers } = useEditorStore();

  const sendToBridge = useCallback((payload: EditorToBridgeMessage) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    const message: MessageEnvelope = {
      channel: 'tnfronte-bridge',
      version: 1,
      direction: 'editor→bridge',
      payload,
      timestamp: Date.now(),
    };

    iframe.contentWindow.postMessage(message, '*');
  }, []);

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      const data = e.data as MessageEnvelope;
      if (data?.channel !== 'tnfronte-bridge') return;
      if (data.direction !== 'bridge→editor') return;

      const msg = data.payload as BridgeToEditorMessage;

      switch (msg.type) {
        case 'ELEMENT_SELECTED': {
          const layer = useEditorStore.getState().layers.find((item) => item.oid === msg.oid);
          selectElement({
            oid: msg.oid,
            tagName: layer?.tagName ?? '',
            filePath: layer?.filePath ?? '',
            startLine: layer?.line ?? 0,
            componentScope: layer?.component ?? '',
            rect: msg.rect,
          });
          break;
        }

        case 'ELEMENT_HOVERED':
          setHoveredOID(msg.oid);
          break;

        case 'BRIDGE_READY':
          console.log('[TNFronte] Bridge is ready');
          fetchLayers();
          break;

        case 'ELEMENT_DBLCLICK':
          sendToBridge({ type: 'START_TEXT_EDIT', oid: msg.oid });
          break;

        case 'TEXT_EDIT_COMPLETE':
          sendAction(msg.oid, { type: 'MODIFY_TEXT', value: msg.newText });
          break;
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [selectElement, sendAction, sendToBridge, setHoveredOID]);

  async function fetchLayers() {
    try {
      const res = await fetch(API.devLayers);
      const data = await res.json();
      if (Array.isArray(data)) {
        setLayers(data);
      }
    } catch {
      // Dev server may not be running yet.
    }
  }

  return { iframeRef, sendToBridge };
}
