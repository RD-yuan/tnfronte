import React, { useState } from 'react';
import { useEditorStore } from '../store/editor-store';

export function Toolbar() {
  const { zoom, setZoom } = useEditorStore();

  return (
    <div className="h-12 bg-panel border-b border-gray-700 flex items-center px-4 gap-4">
      {/* Logo */}
      <div className="text-white font-bold text-lg tracking-tight">
        TNFronte
      </div>

      <div className="w-px h-6 bg-gray-700" />

      {/* Undo / Redo */}
      <button className="text-gray-400 hover:text-white text-sm">↶ Undo</button>
      <button className="text-gray-400 hover:text-white text-sm">↷ Redo</button>

      <div className="w-px h-6 bg-gray-700" />

      {/* Device preview */}
      <select className="bg-surface text-white text-sm rounded px-2 py-1 border border-gray-600">
        <option value="desktop">Desktop (1280×800)</option>
        <option value="tablet">Tablet (768×1024)</option>
        <option value="mobile">Mobile (375×812)</option>
      </select>

      <div className="flex-1" />

      {/* Zoom controls */}
      <button
        className="text-gray-400 hover:text-white text-sm"
        onClick={() => setZoom(zoom - 0.1)}
      >
        −
      </button>
      <span className="text-white text-sm w-12 text-center">
        {Math.round(zoom * 100)}%
      </span>
      <button
        className="text-gray-400 hover:text-white text-sm"
        onClick={() => setZoom(zoom + 0.1)}
      >
        +
      </button>
      <button
        className="text-gray-400 hover:text-white text-sm ml-1"
        onClick={() => setZoom(1)}
      >
        Reset
      </button>
    </div>
  );
}
