import { useEffect, useState, useRef } from 'react';

export interface AcpBridgeState {
  connected: boolean;
  toolCount: number;
}

/**
 * Hook that periodically pings the dev server's ACP endpoint to check
 * availability and report viewer state.
 */
export function useAcpBridge(
  state: { currentScreen: string; activeState: string; totalScreens: number }
) {
  const [acpState, setAcpState] = useState<AcpBridgeState>({
    connected: false,
    toolCount: 0,
  });
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let cancelled = false;

    async function ping() {
      try {
        // Report viewer state to the dev server
        await fetch('/api/acp/tools', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tool: 'designReview_listScreens',
            args: {},
          }),
        });

        if (cancelled) return;

        // Check what tools are available
        const toolsRes = await fetch('/api/acp/tools-list');
        if (toolsRes.ok) {
          const data = (await toolsRes.json()) as { tools: unknown[] };
          setAcpState({ connected: true, toolCount: data.tools.length });
        }
      } catch {
        if (!cancelled) setAcpState({ connected: false, toolCount: 0 });
      }
    }

    ping();
    const interval = setInterval(ping, 10000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return acpState;
}
