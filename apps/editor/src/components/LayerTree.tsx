import React from 'react';
import { useEditorStore } from '../store/editor-store';

export function LayerTree() {
  const { layers, selectedElement, selectElement } = useEditorStore();

  return (
    <div className="w-60 bg-panel border-r border-gray-700 flex flex-col">
      <div className="px-3 py-2 text-gray-400 text-xs font-semibold uppercase tracking-wider border-b border-gray-700">
        Layers
      </div>
      <div className="flex-1 overflow-auto">
        {layers.length === 0 ? (
          <div className="p-3 text-gray-500 text-sm">
            No layers detected.
            <br />
            Start your project's dev server to see elements here.
          </div>
        ) : (
          layers.map((layer) => (
            <div
              key={layer.oid}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-surface/50 ${
                selectedElement?.oid === layer.oid
                  ? 'bg-surface text-white'
                  : 'text-gray-300'
              }`}
              onClick={() =>
                selectElement({
                  oid: layer.oid,
                  tagName: layer.tagName,
                  filePath: layer.filePath,
                  startLine: layer.line,
                  componentScope: layer.component,
                  rect: { x: 0, y: 0, width: 0, height: 0 },
                })
              }
            >
              <span className="text-accent-light text-xs font-mono">
                &lt;{layer.tagName}&gt;
              </span>
              <span className="text-gray-500 text-xs truncate">
                {layer.component} :{layer.line}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
