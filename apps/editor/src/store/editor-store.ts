import { create } from 'zustand';

export interface SelectedElement {
  oid: string;
  tagName: string;
  filePath: string;
  startLine: number;
  componentScope: string;
  rect: { x: number; y: number; width: number; height: number };
}

export interface LayerItem {
  oid: string;
  tagName: string;
  component: string;
  filePath: string;
  line: number;
}

export interface EditorState {
  // Canvas
  zoom: number;
  panX: number;
  panY: number;
  iframeSrc: string;

  // Selection
  selectedElement: SelectedElement | null;
  hoveredOID: string | null;

  // Layers
  layers: LayerItem[];

  // Right panel
  activeTab: 'style' | 'props' | 'events';

  // Actions
  setZoom: (z: number) => void;
  setPan: (x: number, y: number) => void;
  setIframeSrc: (src: string) => void;
  selectElement: (el: SelectedElement | null) => void;
  setHoveredOID: (oid: string | null) => void;
  setLayers: (layers: LayerItem[]) => void;
  setActiveTab: (tab: 'style' | 'props' | 'events') => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  zoom: 1,
  panX: 0,
  panY: 0,
  iframeSrc: 'http://localhost:5173',
  selectedElement: null,
  hoveredOID: null,
  layers: [],
  activeTab: 'style',

  setZoom: (z) => set({ zoom: Math.max(0.25, Math.min(3, z)) }),
  setPan: (x, y) => set({ panX: x, panY: y }),
  setIframeSrc: (src) => set({ iframeSrc: src }),
  selectElement: (el) => set({ selectedElement: el }),
  setHoveredOID: (oid) => set({ hoveredOID: oid }),
  setLayers: (layers) => set({ layers }),
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
