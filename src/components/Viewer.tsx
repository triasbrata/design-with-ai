import { useCallback, useRef, useState, useEffect } from 'react';
import { PhoneFrame } from './PhoneFrame';
import { MarkerOverlay } from './MarkerOverlay';
import type { MarkPayload } from './MarkerOverlay';
import { MetaPanel } from './MetaPanel';
import { DEVICE_PRESETS } from '../constants';
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
}

function calcScale(containerW: number, containerH: number, logicalW: number, logicalH: number): number {
  const pad = 48;
  const availW = (containerW * 0.7) - pad;
  const availH = Math.min(containerH, window.innerHeight * 0.8) - pad;
  const s = Math.min(availW / logicalW, availH / logicalH, 1);
  return Math.max(s, 0.125);
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
}: ViewerProps) {
  const phoneRef = useRef<{ getIframe: () => HTMLIFrameElement | null }>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { width: phoneW, height: phoneH } = DEVICE_PRESETS["phone-v"];
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current?.closest('.content-area');
    if (!el) return;
    const recalc = () => setScale(calcScale(el.clientWidth, el.clientHeight, phoneW, phoneH));
    recalc();
    const obs = new ResizeObserver(recalc);
    obs.observe(el);
    window.addEventListener('resize', recalc);
    return () => { obs.disconnect(); window.removeEventListener('resize', recalc); };
  }, [phoneW, phoneH]);

  const visualW = phoneW * scale;
  const visualH = phoneH * scale;

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

  return (
    <>
      <div className="main-layout">
        <div
          ref={containerRef}
          className="phone-container"
          style={{ width: `${visualW}px`, height: `${visualH}px` }}
        >
          <div style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            width: `${phoneW}px`,
            height: `${phoneH}px`,
            position: 'absolute',
            top: 0,
            left: 0,
          }}>
            <PhoneFrame
              ref={phoneRef}
              key={`${screen}-${activeState}`}
              src={getScreenUrl(screen)}
              onLoad={handleLoad}
              width={phoneW}
              height={phoneH}
            />
            <MarkerOverlay
              active={markerMode}
              rect={markerRect}
              screen={screen}
              activeState={activeState}
              onMark={onMark}
              scale={scale}
            />
          </div>
        </div>
        <MetaPanel
          meta={meta}
          screen={screen}
          activeState={activeState}
          onStateChange={(s) => onStateChange(screen, s)}
        />
      </div>

    </>
  );
}
