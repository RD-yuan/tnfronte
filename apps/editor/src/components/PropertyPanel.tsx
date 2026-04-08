import React from 'react';
import { useEditorStore } from '../store/editor-store';

export function PropertyPanel() {
  const { selectedElement, activeTab, setActiveTab } = useEditorStore();

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
        {activeTab === 'style' && <StyleEditor />}
        {activeTab === 'props' && <PropsEditor />}
        {activeTab === 'events' && <EventsEditor />}
      </div>
    </div>
  );
}

function StyleEditor() {
  // TODO: fetch actual styles from backend via OID
  const styleProps = [
    { name: 'color', value: '#ffffff', type: 'color' },
    { name: 'background-color', value: '#3b82f6', type: 'color' },
    { name: 'font-size', value: '16px', type: 'string' },
    { name: 'width', value: 'auto', type: 'string' },
    { name: 'height', value: 'auto', type: 'string' },
    { name: 'margin', value: '0', type: 'string' },
    { name: 'padding', value: '8px', type: 'string' },
    { name: 'border-radius', value: '0', type: 'string' },
  ];

  return (
    <div className="space-y-2">
      {styleProps.map((prop) => (
        <div key={prop.name} className="flex items-center gap-2">
          <label className="text-gray-400 text-xs w-28 shrink-0">
            {prop.name}
          </label>
          {prop.type === 'color' ? (
            <div className="flex items-center gap-1 flex-1">
              <input
                type="color"
                defaultValue={prop.value}
                className="w-6 h-6 rounded cursor-pointer"
              />
              <input
                type="text"
                defaultValue={prop.value}
                className="bg-surface text-white text-xs px-2 py-1 rounded flex-1 border border-gray-600"
              />
            </div>
          ) : (
            <input
              type="text"
              defaultValue={prop.value}
              className="bg-surface text-white text-xs px-2 py-1 rounded flex-1 border border-gray-600"
            />
          )}
        </div>
      ))}
    </div>
  );
}

function PropsEditor() {
  return (
    <div className="text-gray-500 text-sm">
      <p>Props editor — connect to backend to load actual props.</p>
    </div>
  );
}

function EventsEditor() {
  return (
    <div className="text-gray-500 text-sm">
      <p>Event bindings — coming soon.</p>
    </div>
  );
}
