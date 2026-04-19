import { useEffect, useRef, useCallback, useState } from 'react';
import type { CodeAction, ServerMessage, LayerInfo } from '@tnfronte/shared';
import { useEditorStore } from '../store/editor-store';
import { API, WS_URL } from '../config';

/**
 * useWebSocket — manages the WebSocket connection between the Editor UI
 * and the TNFronte backend.
 *
 * Provides:
 *   - sendAction(oidId, action) — send a CodeAction to the backend
 *   - connected — connection status
 */
export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const { setLayers } = useEditorStore();

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let hasConnectedOnce = false;
    let hasWarnedBackendUnavailable = false;

    async function isBackendAvailable() {
      try {
        const res = await fetch(API.health, { cache: 'no-store' });
        return res.ok;
      } catch {
        return false;
      }
    }

    function scheduleReconnect(delay = 2000) {
      if (disposed) return;
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        void connect();
      }, delay);
    }

    async function connect() {
      if (disposed) return;

      const backendAvailable = await isBackendAvailable();
      if (disposed) return;

      if (!backendAvailable) {
        setConnected(false);

        if (!hasWarnedBackendUnavailable) {
          console.warn('[TNFronte] Backend is unavailable, retrying in 2s...');
          hasWarnedBackendUnavailable = true;
        }

        scheduleReconnect();
        return;
      }

      hasWarnedBackendUnavailable = false;
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (disposed || wsRef.current !== ws) return;
        hasConnectedOnce = true;
        setConnected(true);
        console.log('[TNFronte] WebSocket connected');
      };

      ws.onmessage = (event) => {
        if (disposed || wsRef.current !== ws) return;
        try {
          const msg = JSON.parse(event.data) as ServerMessage;
          handleServerMessage(msg);
        } catch (err) {
          console.error('[TNFronte] Failed to parse WS message:', err);
        }
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
        if (disposed) return;
        setConnected(false);

        if (hasConnectedOnce) {
          console.log('[TNFronte] WebSocket disconnected, reconnecting in 2s...');
        }

        scheduleReconnect();
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    void connect();
    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws && ws.readyState !== WebSocket.CLOSED) {
        ws.close();
      }
    };
  }, [setLayers]);

  function handleServerMessage(msg: ServerMessage) {
    switch (msg.kind) {
      case 'connected':
        console.log('[TNFronte]', msg.message);
        break;

      case 'layers':
        setLayers(msg.layers);
        break;

      case 'action-result':
        if (msg.success) {
          console.log(`[TNFronte] Action applied: ${msg.filePath}`);
        } else {
          console.error('[TNFronte] Action failed:', msg.filePath);
        }
        break;

      case 'file-changed':
        console.log(`[TNFronte] File changed: ${msg.filePath}`);
        break;

      case 'error':
        console.error('[TNFronte] Server error:', msg.message);
        break;
    }
  }

  /** Send a CodeAction to the backend via WebSocket. */
  const sendAction = useCallback((oidId: string, action: CodeAction) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== ws.OPEN) {
      console.error('[TNFronte] WebSocket not connected');
      return;
    }
    ws.send(JSON.stringify({ kind: 'action', oidId, action }));
  }, []);

  /** Send undo request via HTTP. */
  const undo = useCallback(async () => {
    try {
      await fetch(API.undo, { method: 'POST' });
    } catch { /* ignore */ }
  }, []);

  /** Send redo request via HTTP. */
  const redo = useCallback(async () => {
    try {
      await fetch(API.redo, { method: 'POST' });
    } catch { /* ignore */ }
  }, []);

  /** Open a project directory. */
  const openProject = useCallback(async (dir: string) => {
    try {
      const res = await fetch(API.projectOpen, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dir }),
      });
      return await res.json();
    } catch {
      return { success: false };
    }
  }, []);

  /** Fetch layers from backend. */
  const fetchLayers = useCallback(async () => {
    try {
      const res = await fetch(API.layers);
      const layers: LayerInfo[] = await res.json();
      setLayers(layers);
    } catch { /* ignore */ }
  }, [setLayers]);

  return { sendAction, undo, redo, openProject, fetchLayers, connected };
}
