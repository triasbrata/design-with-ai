import { useState } from 'react';
import { AgentPanel } from './AgentPanel';
import { ChatPanel } from './ChatPanel';

interface DrawerTabsProps {
  connected: boolean;
  currentScreen?: string;
}

type Tab = 'agent' | 'chat';

export function DrawerTabs({ connected, currentScreen }: DrawerTabsProps) {
  const [tab, setTab] = useState<Tab>('chat');

  return (
    <div>
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          marginBottom: 12,
          borderBottom: '1px solid var(--brand-border)',
        }}
      >
        <TabButton active={tab === 'chat'} onClick={() => setTab('chat')}>
          Chat with AI
        </TabButton>
        <TabButton active={tab === 'agent'} onClick={() => setTab('agent')}>
          Agent
        </TabButton>
      </div>

      {tab === 'chat' ? (
        <ChatPanel currentScreen={currentScreen} />
      ) : (
        <AgentPanel connected={connected} />
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
