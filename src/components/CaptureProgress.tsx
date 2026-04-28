import { useEffect, useRef, useState } from 'react';
import type { CaptureResult, Metadata } from '../types';
import { Button } from './base';

interface CaptureProgressProps {
  screens: string[];
  metadata: Metadata;
  onDone: (results: CaptureResult[]) => void;
}

declare global {
  interface Window {
    html2canvas: (element: HTMLElement, options?: Record<string, unknown>) => Promise<HTMLCanvasElement>;
    _captureStop?: boolean;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForLoad(iframe: HTMLIFrameElement, timeoutMs: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`iframe load timeout after ${timeoutMs}ms`)), timeoutMs);

    function onLoad() {
      clearTimeout(timer);
      resolve();
    }

    if (iframe.contentDocument?.readyState === 'complete') {
      clearTimeout(timer);
      resolve();
      return;
    }

    iframe.addEventListener('load', onLoad, { once: true });
  });
}

export function CaptureProgress({ screens, metadata, onDone }: CaptureProgressProps) {
  const [currentFile, setCurrentFile] = useState('');
  const [progress, setProgress] = useState('');
  const [resultsLog, setResultsLog] = useState<CaptureResult[]>([]);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    window._captureStop = false;

    let completed = 0;
    let total = 0;
    for (const screen of screens) {
      const meta = metadata.screens[screen];
      const states = meta?.states || ['default'];
      total += states.length;
    }

    (async () => {
      const allResults: CaptureResult[] = [];

      for (const screen of screens) {
        if (!mountedRef.current || window._captureStop) break;

        const meta = metadata.screens[screen];
        const states = meta?.states || ['default'];

        for (let si = 0; si < states.length; si++) {
          if (!mountedRef.current || window._captureStop) break;

          const state = states[si];
          const isFirstState = si === 0;
          const isDefault = state === 'default';
          const filename = isDefault || isFirstState
            ? `phone_${screen}.png`
            : `phone_${screen}_${state}.png`;

          setCurrentFile(filename);
          setProgress(`${completed + 1}/${total}`);

          const wrapper = document.createElement('div');
          wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;width:390px;height:844px';

          const iframe = document.createElement('iframe');
          iframe.style.width = '390px';
          iframe.style.height = '844px';
          iframe.style.border = 'none';
          wrapper.appendChild(iframe);
          document.body.appendChild(wrapper);

          try {
            iframe.src = `/screens/${screen}.html`;
            await waitForLoad(iframe, 15000);

            if (!isDefault && !isFirstState) {
              const win = iframe.contentWindow as
                | (Window & { __baseline?: { setState?: (s: string) => void } })
                | null;

              if (win?.__baseline?.setState) {
                win.postMessage({ type: 'setState', state }, '*');
              } else {
                iframe.src = `/screens/${screen}_${state}.html`;
                await waitForLoad(iframe, 15000);
              }
            }

            await delay(300);

            if (!iframe.contentDocument?.body) {
              throw new Error('iframe body not available');
            }

            const canvas = await window.html2canvas(iframe.contentDocument.body, {
              width: 390,
              height: 844,
              scale: 2,
              backgroundColor: '#fff',
              useCORS: true,
              allowTaint: true,
            });

            const dataUrl = canvas.toDataURL();

            const resp = await fetch('/api/capture', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename, data: dataUrl }),
            });

            const capResult = await resp.json();
            if (!capResult.ok) {
              throw new Error(capResult.error || 'save failed');
            }

            const result: CaptureResult = { filename, ok: true };
            allResults.push(result);
            setResultsLog((prev) => [...prev, result]);
          } catch (err) {
            const result: CaptureResult = {
              filename,
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            };
            allResults.push(result);
            setResultsLog((prev) => [...prev, result]);
          } finally {
            wrapper.remove();
            completed++;
          }
        }
      }

      if (mountedRef.current) {
        doneRef.current(allResults);
      }
    })();

    return () => {
      mountedRef.current = false;
      window._captureStop = true;
    };
    // Run once on mount — intentionally no deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCancel() {
    window._captureStop = true;
  }

  return (
    <div style={{ width: '100%' }}>
      <div className="toolbar">
        <Button color="secondary" size="sm" onClick={handleCancel}>
          &#10005; Cancel
        </Button>
        <span className="name">Creating Baseline...</span>
        <span className="pos">{progress}</span>
      </div>
      <div
        style={{
          padding: '16px',
          fontSize: '12px',
          color: 'var(--brand-muted)',
        }}
      >
        {currentFile}
      </div>
      <div
        style={{
          maxHeight: 'calc(100vh - 180px)',
          overflowY: 'auto',
          padding: '0 16px 16px',
        }}
      >
        {resultsLog.map((r, i) => (
          <div key={i} className={r.ok ? 'cap-result-ok' : 'cap-result-err'}>
            {r.ok ? '\u2713' : '\u2717'} {r.filename}
            {r.error ? ` \u2014 ${r.error}` : ''}
          </div>
        ))}
      </div>
    </div>
  );
}
