import React from 'react';
import { Toolbar } from './components/Toolbar';
import { Canvas } from './components/Canvas';
import { LayerTree } from './components/LayerTree';
import { PropertyPanel } from './components/PropertyPanel';

export function App() {
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
