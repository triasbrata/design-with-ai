import { useState, useEffect, useCallback } from 'react';
import { useScreens } from './hooks/useScreens';
import { useToast } from './hooks/useToast';
import { useAcpBridge } from './acp/useAcpBridge';
import { AgentPanel } from './acp/AgentPanel';
import { Viewer } from './components/Viewer';
import { Summary } from './components/Summary';
import { CaptureProgress } from './components/CaptureProgress';
import { BottomBar } from './components/BottomBar';
import { RightDrawer } from './components/RightDrawer';
import { HelpModal } from './components/HelpModal';
import { Toast } from './components/Toast';
import { screenName } from './constants';
import type { CaptureResult } from './types';

declare global {
  interface Window {
    html2canvas: (element: HTMLElement, options?: Record<string, unknown>) => Promise<HTMLCanvasElement>;
  }
}

export default function App() {
  const {
    metadata,
    orderedScreens,
    currentIndex,
    currentScreen,
    total,
    isSummary,
    navigate,
    goNext,
    goPrev,
    goHome,
  } = useScreens();

  const { toast, show } = useToast();

  const [menuOpen, setMenuOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
  const [activeState, setActiveState] = useState('default');
  const [helpOpen, setHelpOpen] = useState(false);
  const [dockTool, setDockTool] = useState('');
  const [capturing, setCapturing] = useState(false);

  const acpState = useAcpBridge({
    currentScreen,
    activeState,
    totalScreens: total,
  });

  const screenMeta = metadata?.screens?.[currentScreen];
  const screenStates = screenMeta?.states || ['default'];

  // Reset activeState when currentScreen changes
  useEffect(() => {
    setActiveState('default');
  }, [currentScreen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          goPrev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          goNext();
          break;
        case 'Escape':
          e.preventDefault();
          goHome();
          break;
        case '\\':
          e.preventDefault();
          setMenuOpen((prev) => !prev);
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goPrev, goNext, goHome]);

  // Capture the current screen with its active state
  const handleCapture = useCallback(async () => {
    const iframe = document.getElementById('phone-frame') as HTMLIFrameElement | null;
    if (!iframe?.contentDocument?.body) {
      show('No iframe content to capture', false);
      return;
    }

    const states = metadata?.screens?.[currentScreen]?.states || ['default'];
    const isDefaultState = activeState === states[0] || states.length <= 1;
    const filename = isDefaultState
      ? `phone_${currentScreen}.png`
      : `phone_${currentScreen}_${activeState}.png`;

    try {
      if (typeof window.html2canvas !== 'function') {
        show('html2canvas not loaded', false);
        return;
      }

      const canvas = await window.html2canvas(iframe.contentDocument.body, {
        width: 390,
        height: 844,
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: true,
      });
      const dataUrl = canvas.toDataURL('image/png');

      // Trigger download via anchor click
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // POST to /api/capture
      try {
        const res = await fetch('/api/capture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename, data: dataUrl }),
        });
        const result = await res.json();
        if (result.ok) {
          show(`Saved: ${result.path}`, true);
        } else {
          show(`Save failed: ${result.error}`, false);
        }
      } catch {
        show('Captured locally but upload failed', false);
      }
    } catch {
      show('Capture failed', false);
    }
  }, [currentScreen, activeState, metadata, show]);

  // Start batch capture of all screens
  const handleCaptureAll = useCallback(() => {
    setCapturing(true);
  }, []);

  // Called when CaptureProgress finishes
  const handleCaptureAllDone = useCallback(
    (results: CaptureResult[]) => {
      setCapturing(false);
      const okCount = results.filter((r) => r.ok).length;
      const failCount = results.filter((r) => !r.ok).length;
      const msg =
        failCount > 0
          ? `${okCount} succeeded, ${failCount} failed`
          : `All ${okCount} captured`;
      show(msg, failCount === 0);
      navigate('summary');
    },
    [show, navigate]
  );

  // Handle dock tool button clicks
  const handleDockTool = useCallback(
    (tool: string) => {
      if (tool === dockTool) {
        setDockTool('');
        return;
      }
      setDockTool(tool);
      switch (tool) {
        case 'capture':
          handleCapture();
          break;
        case 'summary':
          navigate('summary');
          setDockTool('');
          break;
        case 'help':
          setHelpOpen(true);
          break;
        // 'states' and 'export' are placeholder toggles
        default:
          break;
      }
    },
    [dockTool, handleCapture, navigate]
  );

  // Update active state when Viewer requests a state change
  const handleStateChange = useCallback((_screen: string, state: string) => {
    setActiveState(state);
  }, []);

  // Empty state
  if (orderedScreens.length === 0) {
    return (
      <div className="main-content">
        <div
          style={{
            padding: '40px',
            textAlign: 'center',
            color: 'var(--brand-muted)',
          }}
        >
          No screens found. Check screen-metadata.json.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', width: '100%', height: '100vh' }}>
      {capturing ? (
        <CaptureProgress
          screens={orderedScreens}
          metadata={metadata!}
          onDone={handleCaptureAllDone}
        />
      ) : (
        <>
          <div className="content-area">
            <div className="main-content">
              {isSummary ? (
                <Summary
                  screens={orderedScreens}
                  metadata={metadata}
                  onSelect={navigate}
                  onBack={goPrev}
                  onCaptureAll={handleCaptureAll}
                />
              ) : (
                <Viewer
                  screen={currentScreen}
                  index={currentIndex}
                  total={total}
                  metadata={metadata}
                  activeState={activeState}
                  menuOpen={menuOpen}
                  onToggleMenu={() => setMenuOpen((p) => !p)}
                  onSelectScreen={navigate}
                  onPrev={goPrev}
                  onNext={goNext}
                  onStateChange={handleStateChange}
                />
              )}
            </div>
            <RightDrawer open={rightDrawerOpen} onToggle={() => setRightDrawerOpen((p) => !p)}>
              <AgentPanel connected={acpState.connected} />
            </RightDrawer>
          </div>
          {!isSummary && (
            <BottomBar
              name={screenName(currentScreen)}
              index={currentIndex}
              total={total}
              activeTool={dockTool}
              onToolChange={handleDockTool}
              onPrev={goPrev}
              onNext={goNext}
              onCapture={handleCapture}
              onSummary={() => { goNext(); setDockTool(''); }}
              onHelp={() => setHelpOpen(true)}
            />
          )}
          <HelpModal show={helpOpen} onClose={() => setHelpOpen(false)} />
          <Toast message={toast.message} visible={toast.visible} ok={toast.ok} />
        </>
      )}
    </div>
  );
}
