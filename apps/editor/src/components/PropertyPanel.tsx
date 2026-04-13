import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useEditorStore } from '../store/editor-store';
import { useWebSocket } from '../hooks/use-websocket';
import type { EditableProp } from '@tnfronte/shared';
import { API } from '../config';

/** Debounce delay for style/prop changes (ms) */
const DEBOUNCE_MS = 400;

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

// ─── Style Editor (reads actual props from backend) ────────────────────

function StyleEditor({ oid, sendAction }: { oid: string; sendAction: (id: string, action: any) => void }) {
  const [styleProps, setStyleProps] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Fetch actual props when selection changes
  useEffect(() => {
    let cancelled = false;

    async function fetchProps() {
      setLoading(true);
      try {
        const res = await fetch(`${API.oid(oid)}`);
        if (!res.ok) throw new Error('OID not found');
        const oidData = await res.json();

        // Use extractEditableProps from adapter to get real values
        const fileRes = await fetch(`${API.file}?path=${encodeURIComponent(oidData.filePath)}`);
        if (!fileRes.ok) throw new Error('File not found');
        const { content } = await fileRes.json();

        // Parse style props from the source (simple regex fallback since we don't have direct adapter access)
        const props: Record<string, string> = {};
        const styleMatch = content.match(/style=\{\{([^}]+)\}\}/s);
        if (styleMatch) {
          const pairs = styleMatch[1];
          for (const m of pairs.matchAll(/(\w+)\s*:\s*['"]([^'"]*)['"]/g)) {
            props[m[1]] = m[2];
          }
        }

        // Merge with defaults for common properties not yet set
        const defaults: Record<string, string> = {
          color: props.color ?? '',
          backgroundColor: props.backgroundColor ?? '',
          fontSize: props.fontSize ?? '',
          width: props.width ?? 'auto',
          height: props.height ?? 'auto',
          margin: props.margin ?? '0',
          padding: props.padding ?? '',
          borderRadius: props.borderRadius ?? '',
        };

        if (!cancelled) setStyleProps(defaults);
      } catch {
        // Fallback to defaults if fetch fails
        if (!cancelled) {
          setStyleProps({
            color: '',
            backgroundColor: '',
            fontSize: '',
            width: 'auto',
            height: 'auto',
            margin: '0',
            padding: '',
            borderRadius: '',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchProps();
    return () => { cancelled = true; };
  }, [oid]);

  const handleChange = useCallback(
    (cssProp: string, value: string) => {
      setStyleProps((prev) => ({ ...prev, [cssProp]: value }));

      // Debounce: only send action after user stops typing
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        sendAction(oid, {
          type: 'MODIFY_STYLE',
          prop: cssProp,
          value,
        });
      }, DEBOUNCE_MS);
    },
    [oid, sendAction],
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  if (loading) {
    return <div className="text-gray-500 text-sm">Loading properties...</div>;
  }

  return (
    <div className="space-y-2">
      {Object.entries(styleProps).map(([prop, value]) => (
        <div key={prop} className="flex items-center gap-2">
          <label className="text-gray-400 text-xs w-28 shrink-0">{prop}</label>
          {prop.match(/color|Color/) ? (
            <div className="flex items-center gap-1 flex-1">
              <input
                type="color"
                value={value || '#000000'}
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
