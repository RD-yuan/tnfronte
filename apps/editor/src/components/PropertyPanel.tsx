import React, { useState, useCallback } from 'react';
import { useEditorStore } from '../store/editor-store';
import { useWebSocket } from '../hooks/use-websocket';

export function PropertyPanel() {
  const { selectedElement, activeTab, setActiveTab } = useEditorStore();
  const { sendAction } = useWebSocket();

  if (!selectedElement) {
    return (
      <div className="w-72 bg-panel border-l border-gray-700 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Select an element to edit</p>
      </div>
    );
  }

  return (
    <div className="w-72 bg-panel border-l border-gray-700 flex flex-col">
      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        {(['style', 'props', 'events'] as const).map((tab) => (
          <button
            key={tab}
            className={`flex-1 py-2 text-sm capitalize ${
              activeTab === tab
                ? 'text-white border-b-2 border-accent'
                : 'text-gray-400 hover:text-gray-200'
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Element info */}
      <div className="px-3 py-2 border-b border-gray-700">
        <div className="text-white text-sm font-mono">
          &lt;{selectedElement.tagName || 'element'}&gt;
        </div>
        <div className="text-gray-500 text-xs mt-1 truncate">
          {selectedElement.filePath}:{selectedElement.startLine}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {activeTab === 'style' && <StyleEditor oid={selectedElement.oid} sendAction={sendAction} />}
        {activeTab === 'props' && <PropsEditor />}
        {activeTab === 'events' && <EventsEditor />}
      </div>
    </div>
  );
}

// ─── Style Editor ──────────────────────────────────────────────────────

function StyleEditor({ oid, sendAction }: { oid: string; sendAction: (id: string, action: any) => void }) {
  const [styleProps, setStyleProps] = useState<Record<string, string>>({
    color: '#ffffff',
    backgroundColor: '#3b82f6',
    fontSize: '16px',
    width: 'auto',
    height: 'auto',
    margin: '0',
    padding: '8px',
    borderRadius: '0',
  });

  const handleChange = useCallback(
    (cssProp: string, value: string) => {
      setStyleProps((prev) => ({ ...prev, [cssProp]: value }));
      sendAction(oid, {
        type: 'MODIFY_STYLE',
        prop: cssProp,
        value,
      });
    },
    [oid, sendAction],
  );

  return (
    <div className="space-y-2">
      {Object.entries(styleProps).map(([prop, value]) => (
        <div key={prop} className="flex items-center gap-2">
          <label className="text-gray-400 text-xs w-28 shrink-0">{prop}</label>
          {prop.match(/color|Color/) ? (
            <div className="flex items-center gap-1 flex-1">
              <input
                type="color"
                value={value}
                onChange={(e) => handleChange(prop, e.target.value)}
                className="w-6 h-6 rounded cursor-pointer"
              />
              <input
                type="text"
                value={value}
                onChange={(e) => handleChange(prop, e.target.value)}
                className="bg-surface text-white text-xs px-2 py-1 rounded flex-1 border border-gray-600"
              />
            </div>
          ) : (
            <input
              type="text"
              value={value}
              onChange={(e) => handleChange(prop, e.target.value)}
              className="bg-surface text-white text-xs px-2 py-1 rounded flex-1 border border-gray-600"
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Props Editor ──────────────────────────────────────────────────────

function PropsEditor() {
  return (
    <div className="text-gray-500 text-sm">
      <p>Props editor — connect to backend to load actual props.</p>
    </div>
  );
}

// ─── Events Editor ─────────────────────────────────────────────────────

function EventsEditor() {
  return (
    <div className="text-gray-500 text-sm">
      <p>Event bindings — coming soon.</p>
    </div>
  );
}
