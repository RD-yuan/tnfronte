import React, { useEffect } from 'react';
import { Toolbar } from './components/Toolbar';
import { Canvas } from './components/Canvas';
import { LayerTree } from './components/LayerTree';
import { PropertyPanel } from './components/PropertyPanel';
import { useWebSocket } from './hooks/use-websocket';
import { useEditorStore } from './store/editor-store';

export function App() {
  const { connected, undo, redo, fetchLayers, sendAction } = useWebSocket();
  const { setBackendConnected } = useEditorStore();

  // Sync connection state
  useEffect(() => {
    setBackendConnected(connected);
  }, [connected, setBackendConnected]);

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Undo: Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Redo: Ctrl+Y or Ctrl+Shift+Z
      if (
        ((e.ctrlKey || e.metaKey) && e.key === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')
      ) {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // On mount, try to fetch layers from backend
  useEffect(() => {
    fetchLayers();
  }, [fetchLayers]);

  return (
    <div className="h-screen w-screen flex flex-col bg-canvas text-white">
      <Toolbar connected={connected} undo={undo} redo={redo} />
      <div className="flex flex-1 overflow-hidden">
        <LayerTree />
        <Canvas sendAction={sendAction} />
        <PropertyPanel sendAction={sendAction} />
      </div>
    </div>
  );
}
