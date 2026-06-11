import { useRef } from 'react';
import { useStore } from '../lib/config';

interface Props {
  children: React.ReactNode;
  className?: string;
}

export default function PanelShell({ children, className }: Props) {
  const panelWidth = useStore((s) => s.panelWidth);
  const setPanelWidth = useStore((s) => s.setPanelWidth);

  const dragStateRef = useRef<{ startX: number; startW: number } | null>(null);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    dragStateRef.current = { startX: e.clientX, startW: panelWidth };
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragStateRef.current) return;
    // Panel is on the right side; dragging left (negative dx) widens it
    const dx = e.clientX - dragStateRef.current.startX;
    setPanelWidth(dragStateRef.current.startW - dx);
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    dragStateRef.current = null;
    (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
  }

  return (
    <div className={`side-panel${className ? ` ${className}` : ''}`} style={{ width: panelWidth }}>
      <div
        className="panel-resize-handle"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <button
          className="panel-resize-btn"
          onClick={() => setPanelWidth(panelWidth + 40)}
          title="Widen"
        >
          ‹
        </button>
        <button
          className="panel-resize-btn"
          onClick={() => setPanelWidth(panelWidth - 40)}
          title="Narrow"
        >
          ›
        </button>
      </div>
      {children}
    </div>
  );
}
