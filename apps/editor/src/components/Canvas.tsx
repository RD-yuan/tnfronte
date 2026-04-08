import React, { useState, useRef, WheelEvent, MouseEvent } from 'react';
import { useEditorStore } from '../store/editor-store';
import { useBridge } from '../hooks/use-bridge';

export function Canvas() {
  const { iframeRef, sendToBridge } = useBridge();
  const { zoom, panX, panY, setZoom, setPan, iframeSrc, selectedElement } =
    useEditorStore();

  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  function handleWheel(e: WheelEvent) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(zoom + delta);
    }
  }

  function handleMouseDown(e: MouseEvent) {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY, panX, panY };
    }
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPan(dragStart.current.panX + dx, dragStart.current.panY + dy);
  }

  function handleMouseUp() {
    setIsDragging(false);
  }

  return (
    <div
      className="relative flex-1 bg-canvas overflow-hidden"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* iframe container with zoom/pan transform */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: 'center center',
          transition: isDragging ? 'none' : 'transform 0.1s ease-out',
        }}
      >
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          className="w-[1280px] h-[800px] border border-gray-700 bg-white shadow-2xl"
          title="User Project Preview"
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      </div>

      {/* Selection overlay */}
      {selectedElement && (
        <div
          className="absolute pointer-events-none border-2 border-accent rounded-sm"
          style={{
            left: selectedElement.rect.x * zoom + panX,
            top: selectedElement.rect.y * zoom + panY,
            width: selectedElement.rect.width * zoom,
            height: selectedElement.rect.height * zoom,
            boxShadow: '0 0 0 1px rgba(59,130,246,0.3)',
          }}
        >
          {/* Label */}
          <div className="absolute -top-6 left-0 bg-accent text-white text-xs px-2 py-0.5 rounded-t whitespace-nowrap">
            {selectedElement.tagName || selectedElement.oid.slice(0, 12)}
          </div>

          {/* Corner handles */}
          {['nw', 'ne', 'sw', 'se'].map((pos) => (
            <div
              key={pos}
              className={`absolute w-2 h-2 bg-white border border-accent ${
                pos === 'nw'
                  ? '-top-1 -left-1 cursor-nw-resize'
                  : pos === 'ne'
                    ? '-top-1 -right-1 cursor-ne-resize'
                    : pos === 'sw'
                      ? '-bottom-1 -left-1 cursor-sw-resize'
                      : '-bottom-1 -right-1 cursor-se-resize'
              }`}
            />
          ))}
        </div>
      )}

      {/* Zoom indicator */}
      <div className="absolute bottom-4 right-4 bg-panel/80 text-white text-sm px-3 py-1 rounded">
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}
