import { useEffect, useRef, useCallback } from 'react';
import type { MessageEnvelope, BridgeToEditorMessage } from '@tnfronte/shared';
import { useEditorStore } from '../store/editor-store';
import { API } from '../config';

/**
 * Handles postMessage communication with the Bridge script running
 * inside the user-project iframe.
 */
export function useBridge(sendAction: (oidId: string, action: any) => void) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { selectElement, setHoveredOID } = useEditorStore();

  // Listen for Bridge messages
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      const data = e.data as MessageEnvelope;
      if (data?.channel !== 'tnfronte-bridge') return;
      if (data.direction !== 'bridge→editor') return;

      const msg = data.payload as BridgeToEditorMessage;

      switch (msg.type) {
        case 'ELEMENT_SELECTED': {
          enrichSelection(msg.oid, msg.rect, selectElement);
          break;
        }

        case 'ELEMENT_HOVERED':
          setHoveredOID(msg.oid);
          break;

        case 'BRIDGE_READY':
          console.log('[TNFronte] Bridge is ready');
          break;

        case 'TEXT_EDIT_COMPLETE':
          sendAction(msg.oid, { type: 'MODIFY_TEXT', value: msg.newText });
          break;
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [selectElement, setHoveredOID, sendAction]);

  // Send command to Bridge inside iframe
  const sendToBridge = useCallback(
    (payload: any) => {
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) return;
      iframe.contentWindow.postMessage(
        {
          channel: 'tnfronte-bridge',
          version: 1,
          direction: 'editor→bridge',
          payload,
          timestamp: Date.now(),
        },
        '*',
      );
    },
    [],
  );

  return { iframeRef, sendToBridge };
}

/**
 * Look up the OID in the backend to get tagName, filePath, startLine etc.
 */
async function enrichSelection(
  oid: string,
  rect: { x: number; y: number; width: number; height: number },
  selectElement: (el: any) => void,
) {
  try {
    const res = await fetch(API.oid(oid));
    if (res.ok) {
      const oidData = await res.json();
      selectElement({
        oid: oidData.id,
        tagName: oidData.tagName,
        filePath: oidData.filePath,
        startLine: oidData.startLine,
        componentScope: oidData.componentScope,
        rect,
      });
    } else {
      selectElement({
        oid,
        tagName: '',
        filePath: '',
        startLine: 0,
        componentScope: '',
        rect,
      });
    }
  } catch {
    selectElement({
      oid,
      tagName: '',
      filePath: '',
      startLine: 0,
      componentScope: '',
      rect,
    });
  }
}
