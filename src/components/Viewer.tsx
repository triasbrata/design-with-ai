import { useCallback, useRef } from 'react';
import { PhoneFrame } from './PhoneFrame';
import { MetaPanel } from './MetaPanel';
import type { Metadata, Marker, MarkerContext } from '../types';

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
  markingEnabled: boolean;
  markers: Marker[];
  onMarkerCreate: (ctx: MarkerContext) => void;
  onRemoveMarker: (id: string) => void;
  onToggleMarking: () => void;
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
  markingEnabled,
  markers,
  onMarkerCreate,
  onRemoveMarker,
  onToggleMarking,
}: ViewerProps) {
  const phoneRef = useRef<{ getIframe: () => HTMLIFrameElement | null }>(null);

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
        <PhoneFrame
          ref={phoneRef}
          key={`${screen}-${activeState}`}
          src={getScreenUrl(screen)}
          onLoad={handleLoad}
          screen={screen}
          markingEnabled={markingEnabled}
          markers={markers}
          onMarkerCreate={onMarkerCreate}
          onRemoveMarker={onRemoveMarker}
          onToggleMarking={onToggleMarking}
        />
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
