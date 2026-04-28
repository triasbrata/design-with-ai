import { useCallback, useRef } from 'react';
import { PhoneFrame } from './PhoneFrame';
import { MetaPanel } from './MetaPanel';
import { ScreenMenu } from './ScreenMenu';
import type { Metadata } from '../types';

interface ViewerProps {
  screen: string;
  index: number;
  total: number;
  metadata: Metadata | null;
  activeState: string;
  dir: string;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onSelectScreen: (screen: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onStateChange: (screen: string, state: string) => void;
}

export function Viewer({
  screen,
  index,
  total,
  metadata,
  activeState,
  dir,
  menuOpen,
  onToggleMenu,
  onSelectScreen,
  onPrev,
  onNext,
  onStateChange,
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
    iframe.src = `/screens/${screen}_${activeState}.html?dir=${encodeURIComponent(dir)}`;
  }, [activeState, screen, dir]);

  const screens = metadata ? Object.keys(metadata.screens) : [];

  return (
    <>
      <div className="burger-float">
        <ScreenMenu
          screens={screens}
          activeScreen={screen}
          onSelect={onSelectScreen}
          open={menuOpen}
          onToggle={onToggleMenu}
        />
      </div>

      <div className="main-layout">
        <PhoneFrame
          ref={phoneRef}
          key={`${screen}-${activeState}`}
          src={`/screens/${screen}.html?dir=${encodeURIComponent(dir)}`}
          onLoad={handleLoad}
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
