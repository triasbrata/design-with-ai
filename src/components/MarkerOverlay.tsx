import { useState, useCallback, useRef } from 'react';
import { cn } from '../lib/cn';
import type { MarkerRect } from '../types';

export interface MarkPayload {
  rect: MarkerRect;
  screen: string;
  state: string;
}

interface MarkerOverlayProps {
  active: boolean;
  rect: MarkerRect | null;
  screen: string;
  activeState: string;
  onMark: (payload: MarkPayload) => void;
  scale: number;
}

export function MarkerOverlay({ active, rect, screen, activeState, onMark, scale }: MarkerOverlayProps) {
  const [drawing, setDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [drawEnd, setDrawEnd] = useState({ x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);

  const getPos = useCallback((clientX: number, clientY: number) => {
    const bounds = overlayRef.current?.getBoundingClientRect();
    if (!bounds) return { x: 0, y: 0 };
    // getBoundingClientRect returns visual (scaled) coordinates inside the scaled container.
    // Divide by scale to convert back to logical pixels used by the iframe content.
    return {
      x: (clientX - bounds.left) / scale,
      y: (clientY - bounds.top) / scale,
    };
  }, [scale]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!active) return;
    setDrawing(true);
    setDrawStart(getPos(e.clientX, e.clientY));
    setDrawEnd(getPos(e.clientX, e.clientY));
  }, [active, getPos]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drawing) return;
    setDrawEnd(getPos(e.clientX, e.clientY));
  }, [drawing, getPos]);

  const finishDraw = useCallback(() => {
    if (!drawing) return;
    setDrawing(false);
    const x = Math.min(drawStart.x, drawEnd.x);
    const y = Math.min(drawStart.y, drawEnd.y);
    const w = Math.abs(drawEnd.x - drawStart.x);
    const h = Math.abs(drawEnd.y - drawStart.y);
    if (w < 5 && h < 5) return; // ignore tiny clicks
    onMark({ rect: { x, y, width: w, height: h }, screen, state: activeState });
  }, [drawing, drawStart, drawEnd, onMark, screen, activeState]);

  const showRect = rect && !drawing;
  const drawingRect = drawing
    ? {
        left: Math.min(drawStart.x, drawEnd.x),
        top: Math.min(drawStart.y, drawEnd.y),
        width: Math.abs(drawEnd.x - drawStart.x),
        height: Math.abs(drawEnd.y - drawStart.y),
      }
    : null;

  if (!active && !rect) return null;

  return (
    <div
      data-caid="marker-overlay"
      ref={overlayRef}
      className={cn(
          "absolute inset-0 z-10",
          active ? "cursor-crosshair" : "pointer-events-none"
        )}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={finishDraw}
      onMouseLeave={drawing ? finishDraw : undefined}
    >
      {showRect && (
        <div
          className="absolute border-2 border-dashed border-[var(--brand-accent)] bg-[rgba(196,83,83,0.08)] pointer-events-none"
          style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
        />
      )}

      {drawingRect && (
        <>
          <div
            className="absolute border-2 border-dashed border-[var(--brand-accent)] bg-[rgba(196,83,83,0.12)] pointer-events-none"
            style={{
              left: drawingRect.left,
              top: drawingRect.top,
              width: drawingRect.width,
              height: drawingRect.height,
            }}
          />
          <div
            className="absolute text-[11px] font-semibold text-white bg-[var(--brand-accent)] px-[6px] py-[1px] rounded whitespace-nowrap pointer-events-none leading-[1.4]"
            style={{ left: drawingRect.left, top: drawingRect.top - 22 }}
          >
            {Math.round(drawingRect.width)} &times; {Math.round(drawingRect.height)}
          </div>
        </>
      )}
    </div>
  );
}
