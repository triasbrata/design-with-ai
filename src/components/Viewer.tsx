import { useCallback, useRef, useState, useEffect } from 'react';
import { PhoneFrame } from './PhoneFrame';
import { MarkerOverlay } from './MarkerOverlay';
import type { MarkPayload } from './MarkerOverlay';
import { MetaPanel } from './MetaPanel';
import { Minus, Plus } from './base/icons';
import type { Metadata, MarkerRect } from '../types';

interface ViewerProps {
  screen: string;
  index: number;
  total: number;
  metadata: Metadata | null;
  activeState: string;
  getScreenUrl: (screen: string, state?: string) => string;
  onSelectScreen: (screen: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onStateChange: (screen: string, state: string) => void;
  markerMode: boolean;
  markerRect: MarkerRect | null;
  onMark: (payload: MarkPayload) => void;
  scale: number;
  logicalW: number;
  logicalH: number;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

export function Viewer({
  screen,
  index,
  total,
  metadata,
  activeState,
  getScreenUrl,
  onSelectScreen,
  onPrev,
  onNext,
  onStateChange,
  markerMode,
  markerRect,
  onMark,
  scale,
  logicalW,
  logicalH,
}: ViewerProps) {
  const phoneRef = useRef<{ getIframe: () => HTMLIFrameElement | null }>(null);
  const [metaWidth, setMetaWidth] = useState(340);
  const [zoomLevel, setZoomLevel] = useState(1);
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Base fit scale * user zoom
  const effectiveScale = clamp(scale * zoomLevel, 0.125, 1.5);
  const isZoomed = effectiveScale > scale * 1.01;
  const zoomPct = Math.round(effectiveScale * 100);

  // Reset zoom when device mode or screen changes
  useEffect(() => {
    setZoomLevel(1);
  }, [logicalW]);

  // Pinch-to-zoom / ctrl+wheel
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = -e.deltaY * 0.002;
      setZoomLevel((prev) => clamp(prev + delta, 0.125 / scale, 1.5 / scale));
    }

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [scale]);

  // Zoom controls
  function zoomIn() {
    setZoomLevel((prev) => clamp(prev + 0.25, 0.125 / scale, 1.5 / scale));
  }
  function zoomOut() {
    setZoomLevel((prev) => clamp(prev - 0.25, 0.125 / scale, 1.5 / scale));
  }
  function zoomReset() {
    setZoomLevel(1);
  }

  const containerOverflow = effectiveScale > scale * 1.01 ? 'auto' : 'hidden';

  // Resizer
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging.current) return;
      const container = document.querySelector('.main-layout');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const w = rect.right - e.clientX;
      setMetaWidth(Math.max(200, Math.min(600, w)));
    }
    function onUp() {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  const meta = metadata?.screens?.[screen];

  const handleLoad = useCallback(() => {
    if (activeState === 'default') return;

    const iframe = phoneRef.current?.getIframe();
    if (!iframe?.contentWindow) return;

    try {
      const win = iframe.contentWindow as unknown as Record<string, unknown>;
      const baseline = win.__baseline as Record<string, unknown> | undefined;
      const hasContract = typeof baseline?.setState === 'function';

      if (hasContract) {
        iframe.contentWindow.postMessage(
          { type: 'setState', state: activeState },
          '*',
        );
        return;
      }
    } catch {
      // Fall through to variant file load
    }

    // No contract - load variant file directly
    iframe.src = getScreenUrl(screen, activeState);
  }, [activeState, screen, getScreenUrl]);

  const visualW = logicalW * effectiveScale;
  const visualH = logicalH * effectiveScale;

  return (
    <>
      <div className="main-layout">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div
            ref={containerRef}
            className="phone-container"
            style={{
              width: `${visualW}px`,
              height: `${visualH}px`,
              flexShrink: 0,
              position: 'relative',
              overflow: containerOverflow,
            }}
          >
            <div
              style={{
                transform: `scale(${effectiveScale})`,
                transformOrigin: 'top left',
                width: `${logicalW}px`,
                height: `${logicalH}px`,
                position: 'absolute',
                top: 0,
                left: 0,
              }}
            >
              <PhoneFrame
                ref={phoneRef}
                key={`${screen}-${activeState}`}
                src={getScreenUrl(screen)}
                onLoad={handleLoad}
                width={logicalW}
                height={logicalH}
              />
              <MarkerOverlay
                active={markerMode}
                rect={markerRect}
                screen={screen}
                activeState={activeState}
                onMark={onMark}
                scale={effectiveScale}
              />
            </div>
          </div>

          {/* Zoom controls */}
          <div className="zoom-controls">
            <button className="zoom-btn" onClick={zoomOut} title="Zoom out">
              <Minus size={14} />
            </button>
            <button className="zoom-pct" onClick={zoomReset} title="Reset zoom (fit)">
              {zoomPct}%
            </button>
            <button className="zoom-btn" onClick={zoomIn} title="Zoom in">
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Resizer handle */}
        <div
          className="meta-resizer"
          onMouseDown={startResize}
        />
        <div style={{ width: metaWidth, flexShrink: 0, minWidth: 0 }}>
          <MetaPanel
            meta={meta}
            screen={screen}
            activeState={activeState}
            onStateChange={(s) => onStateChange(screen, s)}
          />
        </div>
      </div>

    </>
  );
}
