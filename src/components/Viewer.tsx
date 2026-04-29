import { useCallback, useRef } from 'react';
import { PhoneFrame } from './PhoneFrame';
import { MarkerOverlay } from './MarkerOverlay';
import type { MarkPayload } from './MarkerOverlay';
import { MetaPanel } from './MetaPanel';
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

  const visualW = logicalW * scale;
  const visualH = logicalH * scale;

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
          className="phone-container"
          style={{ width: `${visualW}px`, height: `${visualH}px` }}
        >
          <div style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            width: `${logicalW}px`,
            height: `${logicalH}px`,
            position: 'absolute',
            top: 0,
            left: 0,
          }}>
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
