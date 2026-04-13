import React, { useEffect } from 'react';
import { Toolbar } from './components/Toolbar';
import { Canvas } from './components/Canvas';
import { LayerTree } from './components/LayerTree';
import { PropertyPanel } from './components/PropertyPanel';
import { useWebSocket } from './hooks/use-websocket';
import { useEditorStore } from './store/editor-store';

/** Default project path — the test-fixture project */
const DEFAULT_PROJECT_DIR = '/root/tnfronte/test-fixture';

export function App() {
  const { connected, undo, redo, openProject, fetchLayers } = useWebSocket();
  const { setBackendConnected } = useEditorStore();

  // Sync connection state
  useEffect(() => {
    setBackendConnected(connected);
  }, [connected, setBackendConnected]);

  // When backend connects, open the default project and fetch layers
  useEffect(() => {
    if (!connected) return;
    openProject(DEFAULT_PROJECT_DIR);
    fetchLayers();
  }, [connected, openProject, fetchLayers]);

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

  return (
    <div className="h-screen w-screen flex flex-col bg-canvas text-white">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <LayerTree />
        <Canvas />
        <PropertyPanel />
      </div>
    </div>
  );
}
