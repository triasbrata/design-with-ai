import { useState } from 'react';
import { AgentPanel } from './AgentPanel';
import { ChatPanel } from './ChatPanel';
import type { MarkerContext } from '../types';

interface DrawerTabsProps {
  connected: boolean;
  currentScreen?: string;
  markerContext?: MarkerContext | null;
  onResetMarker?: () => void;
}

type Tab = 'agent' | 'chat';

export function DrawerTabs({ connected, currentScreen, markerContext, onResetMarker }: DrawerTabsProps) {
  const [tab, setTab] = useState<Tab>('chat');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--brand-border)',
          flexShrink: 0,
        }}
      >
        <TabButton active={tab === 'chat'} onClick={() => setTab('chat')}>
          Chat with AI
        </TabButton>
        <TabButton active={tab === 'agent'} onClick={() => setTab('agent')}>
          Agent
        </TabButton>
      </div>

      {/* Content */}
      {tab === 'chat' ? (
        <ChatPanel currentScreen={currentScreen} markerContext={markerContext} onResetMarker={onResetMarker} />
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px' }}>
          <AgentPanel connected={connected} />
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '8px 4px',
        border: 'none',
        background: 'none',
        fontFamily: 'inherit',
        fontSize: 12,
        fontWeight: active ? 700 : 500,
        color: active ? 'var(--brand-accent)' : 'var(--brand-muted)',
        cursor: 'pointer',
        borderBottom: active ? '2px solid var(--brand-accent)' : '2px solid transparent',
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  );
}
