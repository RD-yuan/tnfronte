import React from 'react';
import { useEditorStore } from '../store/editor-store';

interface ToolbarProps {
  connected: boolean;
  undo: () => void | Promise<void>;
  redo: () => void | Promise<void>;
}

export function Toolbar({ connected, undo, redo }: ToolbarProps) {
  const { zoom, setZoom, backendConnected } = useEditorStore();

  return (
    <div className="h-12 bg-panel border-b border-gray-700 flex items-center px-4 gap-4">
      <div className="text-white font-bold text-lg tracking-tight flex items-center gap-2">
        TNFronte
        <span
          className={`w-2 h-2 rounded-full ${
            backendConnected || connected ? 'bg-green-500' : 'bg-red-500'
          }`}
          title={backendConnected || connected ? 'Connected to backend' : 'Disconnected'}
        />
      </div>

      <div className="w-px h-6 bg-gray-700" />

      <button
        className="text-gray-400 hover:text-white text-sm disabled:opacity-30"
        onClick={undo}
        title="Undo (Ctrl+Z)"
      >
        Undo
      </button>
      <button
        className="text-gray-400 hover:text-white text-sm disabled:opacity-30"
        onClick={redo}
        title="Redo (Ctrl+Y)"
      >
        Redo
      </button>

      <div className="w-px h-6 bg-gray-700" />

      <select className="bg-surface text-white text-sm rounded px-2 py-1 border border-gray-600">
        <option value="desktop">Desktop (1280x800)</option>
        <option value="tablet">Tablet (768x1024)</option>
        <option value="mobile">Mobile (375x812)</option>
      </select>

      <div className="flex-1" />

      <button
        className="text-gray-400 hover:text-white text-sm"
        onClick={() => setZoom(zoom - 0.1)}
      >
        -
      </button>
      <span className="text-white text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
      <button
        className="text-gray-400 hover:text-white text-sm"
        onClick={() => setZoom(zoom + 0.1)}
      >
        +
      </button>
      <button className="text-gray-400 hover:text-white text-sm ml-1" onClick={() => setZoom(1)}>
        Reset
      </button>
    </div>
  );
}
