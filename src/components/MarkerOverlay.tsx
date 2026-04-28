import { useState, useRef, useCallback } from "react";
import type { Marker, MarkerContext, MarkerRect } from "../types";

interface MarkerOverlayProps {
  getIframe: () => HTMLIFrameElement | null;
  screen: string;
  enabled: boolean;
  markers: Marker[];
  onMarkerCreate: (ctx: MarkerContext) => void;
  onRemoveMarker: (id: string) => void;
}

export function MarkerOverlay({
  getIframe,
  screen,
  enabled,
  markers,
  onMarkerCreate,
  onRemoveMarker,
}: MarkerOverlayProps) {
  const [drawing, setDrawing] = useState(false);
  const [start, setStart] = useState({ x: 0, y: 0 });
  const [current, setCurrent] = useState({ x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);

  const getPos = useCallback((e: React.MouseEvent) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled) return;
      e.preventDefault();
      const pos = getPos(e);
      setStart(pos);
      setCurrent(pos);
      setDrawing(true);
    },
    [enabled, getPos],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!drawing) return;
      e.preventDefault();
      setCurrent(getPos(e));
    },
    [drawing, getPos],
  );

  const handleMouseUp = useCallback(() => {
    if (!drawing) return;
    setDrawing(false);

    const x = Math.min(start.x, current.x);
    const y = Math.min(start.y, current.y);
    const w = Math.abs(current.x - start.x);
    const h = Math.abs(current.y - start.y);

    // Ignore tiny clicks (min 8px)
    if (w < 8 || h < 8) return;

    const rect: MarkerRect = { x, y, width: w, height: h };
    extractContext(rect);
  }, [drawing, start, current, screen]);

  function extractContext(rect: MarkerRect) {
    const iframe = getIframe();
    if (!iframe?.contentDocument) return;

    const doc = iframe.contentDocument;
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;

    try {
      const elements = doc.elementsFromPoint(cx, cy);
      const path: string[] = [];
      for (const el of elements) {
        if (el === doc.documentElement || el === doc.body) continue;
        if (path.length >= 5) break;
        const tag = el.tagName.toLowerCase();
        const cls = (el as HTMLElement).className?.toString()?.split(" ")[0] || "";
        const id = el.id ? `#${el.id}` : "";
        path.push(cls ? `${tag}.${cls}${id}` : `${tag}${id}`);
      }

      const deepest = elements[0] as HTMLElement;
      const text = deepest?.textContent?.trim().slice(0, 200) || "";
      const html = deepest?.outerHTML?.slice(0, 500) || undefined;
      const parent = (elements[1] || elements[0]) as HTMLElement;
      const parentText = parent?.textContent?.trim().slice(0, 500) || "";

      onMarkerCreate({
        id: crypto.randomUUID(),
        rect,
        screen,
        elementPath: path,
        text,
        html,
        parentText,
        timestamp: Date.now(),
      });
    } catch {
      // cross-origin or missing DOM — silently skip
    }
  }

  // Calculate drawing rect
  const drawRect: MarkerRect | null = drawing
    ? {
        x: Math.min(start.x, current.x),
        y: Math.min(start.y, current.y),
        width: Math.abs(current.x - start.x),
        height: Math.abs(current.y - start.y),
      }
    : null;

  return (
    <div
      ref={overlayRef}
      className={`marker-overlay${enabled ? " active" : ""}`}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        cursor: enabled ? "crosshair" : "default",
        pointerEvents: enabled ? "auto" : "none",
        zIndex: 10,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => drawing && setDrawing(false)}
    >
      {/* Render existing markers */}
      {markers
        .filter((m) => m.screen === screen)
        .map((m) => (
          <div
            key={m.id}
            className="marker-rect"
            style={{
              position: "absolute",
              left: m.rect.x,
              top: m.rect.y,
              width: m.rect.width,
              height: m.rect.height,
              border: `2px solid ${m.color}`,
              background: `${m.color}15`,
              pointerEvents: "auto",
            }}
            title={m.text}
          >
            <span
              className="marker-label"
              style={{ background: m.color }}
            >
              {m.text.slice(0, 20)}
            </span>
            <button
              className="marker-close"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveMarker(m.id);
              }}
              aria-label="Remove marker"
            >
              ×
            </button>
          </div>
        ))}

      {/* Drawing preview */}
      {drawRect && drawRect.width > 0 && drawRect.height > 0 && (
        <div
          className="marker-drawing"
          style={{
            position: "absolute",
            left: drawRect.x,
            top: drawRect.y,
            width: drawRect.width,
            height: drawRect.height,
            border: "2px dashed var(--brand-accent)",
            background: "var(--brand-accent-light)",
          }}
        />
      )}
    </div>
  );
}
