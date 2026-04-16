import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { CodeAction, EditableProp } from '@tnfronte/shared';
import { API } from '../config';
import { useEditorStore } from '../store/editor-store';

const DEBOUNCE_MS = 400;

const DEFAULT_STYLE_PROPS: Record<string, string> = {
  color: '',
  backgroundColor: '',
  fontSize: '',
  width: 'auto',
  height: 'auto',
  margin: '0',
  padding: '',
  borderRadius: '',
};

interface PropertyPanelProps {
  sendAction: (id: string, action: CodeAction) => void;
}

export function PropertyPanel({ sendAction }: PropertyPanelProps) {
  const { selectedElement, activeTab, setActiveTab } = useEditorStore();
  const { props, loading } = useEditableProps(selectedElement?.oid);

  if (!selectedElement) {
    return (
      <div className="w-72 bg-panel border-l border-gray-700 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Select an element to edit</p>
      </div>
    );
  }

  return (
    <div className="w-72 bg-panel border-l border-gray-700 flex flex-col">
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

      <div className="px-3 py-2 border-b border-gray-700">
        <div className="text-white text-sm font-mono">
          &lt;{selectedElement.tagName || 'element'}&gt;
        </div>
        <div className="text-gray-500 text-xs mt-1 truncate">
          {selectedElement.filePath}:{selectedElement.startLine}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3">
        {activeTab === 'style' && (
          <StyleEditor oid={selectedElement.oid} props={props} loading={loading} sendAction={sendAction} />
        )}
        {activeTab === 'props' && (
          <PropsEditor oid={selectedElement.oid} props={props} loading={loading} sendAction={sendAction} />
        )}
        {activeTab === 'events' && <EventsEditor props={props} loading={loading} />}
      </div>
    </div>
  );
}

function useEditableProps(oid?: string) {
  const [props, setProps] = useState<EditableProp[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!oid) {
      setProps([]);
      setLoading(false);
      return;
    }

    const currentOid = oid;
    let cancelled = false;

    async function fetchProps() {
      setLoading(true);

      try {
        const res = await fetch(API.oidProps(currentOid));
        if (!res.ok) throw new Error('Props not found');

        const data = (await res.json()) as { props?: EditableProp[] };
        if (!cancelled) {
          setProps(data.props ?? []);
        }
      } catch {
        if (!cancelled) {
          setProps([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchProps();
    return () => {
      cancelled = true;
    };
  }, [oid]);

  return { props, loading };
}

function StyleEditor({
  oid,
  props,
  loading,
  sendAction,
}: {
  oid: string;
  props: EditableProp[];
  loading: boolean;
  sendAction: (id: string, action: CodeAction) => void;
}) {
  const [styleProps, setStyleProps] = useState<Record<string, string>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const extracted = props.reduce<Record<string, string>>((acc, prop) => {
      if (prop.name.startsWith('style.')) {
        acc[prop.name.slice('style.'.length)] = prop.value;
      }
      return acc;
    }, {});

    setStyleProps({
      ...DEFAULT_STYLE_PROPS,
      ...extracted,
    });
  }, [props]);

  const handleChange = useCallback(
    (cssProp: string, value: string) => {
      setStyleProps((prev) => ({ ...prev, [cssProp]: value }));

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

function PropsEditor({
  oid,
  props,
  loading,
  sendAction,
}: {
  oid: string;
  props: EditableProp[];
  loading: boolean;
  sendAction: (id: string, action: CodeAction) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const propItems = props.filter(
    (prop) => !prop.name.startsWith('style.') && !prop.name.startsWith('on'),
  );

  useEffect(() => {
    setDrafts(Object.fromEntries(propItems.map((prop) => [prop.name, prop.value])));
  }, [propItems]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const queueAction = useCallback(
    (action: CodeAction) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        sendAction(oid, action);
      }, DEBOUNCE_MS);
    },
    [oid, sendAction],
  );

  if (loading) {
    return <div className="text-gray-500 text-sm">Loading properties...</div>;
  }

  if (propItems.length === 0) {
    return <div className="text-gray-500 text-sm">No editable props found.</div>;
  }

  return (
    <div className="space-y-3">
      {propItems.map((prop) => {
        const value = drafts[prop.name] ?? prop.value;

        if (prop.name === 'children') {
          return (
            <div key={prop.name} className="space-y-1">
              <label className="text-gray-400 text-xs">text</label>
              <textarea
                value={value}
                rows={3}
                onChange={(e) => {
                  const next = e.target.value;
                  setDrafts((prev) => ({ ...prev, [prop.name]: next }));
                  queueAction({ type: 'MODIFY_TEXT', value: next });
                }}
                className="w-full bg-surface text-white text-xs px-2 py-1.5 rounded border border-gray-600 resize-y"
              />
            </div>
          );
        }

        if (prop.type === 'expression') {
          return (
            <ReadonlyPropRow
              key={prop.name}
              label={prop.name}
              value={value}
              note="Expression props are read-only for now."
            />
          );
        }

        if (prop.type === 'boolean') {
          return (
            <label key={prop.name} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-400 text-xs">{prop.name}</span>
              <input
                type="checkbox"
                checked={value === 'true'}
                onChange={(e) => {
                  const next = String(e.target.checked);
                  setDrafts((prev) => ({ ...prev, [prop.name]: next }));
                  sendAction(oid, {
                    type: 'MODIFY_PROP',
                    prop: prop.name,
                    value: e.target.checked,
                  });
                }}
              />
            </label>
          );
        }

        return (
          <div key={prop.name} className="flex items-center gap-2">
            <label className="text-gray-400 text-xs w-24 shrink-0">{prop.name}</label>
            <input
              type={prop.type === 'number' ? 'number' : 'text'}
              value={value}
              onChange={(e) => {
                const next = e.target.value;
                setDrafts((prev) => ({ ...prev, [prop.name]: next }));

                const typedValue = coercePropValue(prop.type, next);
                if (typedValue == null) return;

                queueAction({
                  type: 'MODIFY_PROP',
                  prop: prop.name,
                  value: typedValue,
                });
              }}
              className="bg-surface text-white text-xs px-2 py-1 rounded flex-1 border border-gray-600"
            />
          </div>
        );
      })}
    </div>
  );
}

function EventsEditor({
  props,
  loading,
}: {
  props: EditableProp[];
  loading: boolean;
}) {
  const events = props.filter((prop) => prop.name.startsWith('on'));

  if (loading) {
    return <div className="text-gray-500 text-sm">Loading events...</div>;
  }

  if (events.length === 0) {
    return <div className="text-gray-500 text-sm">No event bindings found.</div>;
  }

  return (
    <div className="space-y-3">
      {events.map((eventProp) => (
        <ReadonlyPropRow
          key={eventProp.name}
          label={eventProp.name}
          value={eventProp.value}
          note="Editing expressions is not supported yet."
        />
      ))}
    </div>
  );
}

function ReadonlyPropRow({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <label className="text-gray-400 text-xs">{label}</label>
        <span className="text-[10px] uppercase tracking-wide text-gray-500">read only</span>
      </div>
      <code className="block bg-surface text-gray-200 text-xs px-2 py-1.5 rounded border border-gray-700 break-all">
        {value || '(empty)'}
      </code>
      <p className="text-[11px] text-gray-500">{note}</p>
    </div>
  );
}

function coercePropValue(type: EditableProp['type'], value: string): string | number | boolean | null {
  if (type === 'number') {
    if (value.trim() === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (type === 'boolean') {
    return value === 'true';
  }

  return value;
}
