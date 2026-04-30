interface AgentPanelProps {
  connected: boolean;
}

export function AgentPanel({ connected }: AgentPanelProps) {
  return (
    <div data-caid="acp/agent-panel" style={{ padding: '12px 0' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
          fontSize: 12,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: connected ? '#2D6A4F' : '#C45353',
            display: 'inline-block',
          }}
        />
        <span style={{ fontWeight: 600 }}>
          ACP {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      <p style={{ fontSize: 11, color: '#8A8075', lineHeight: 1.5 }}>
        The Agent Client Protocol (ACP) endpoint lets AI agents query design review data.
      </p>

      <div
        style={{
          marginTop: 12,
          padding: 10,
          background: '#F5EFE6',
          borderRadius: 8,
          fontSize: 10,
          color: '#4A4A4A',
          fontFamily: 'monospace',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 11 }}>
          Available Tools
        </div>
        {[
          'designReview_listScreens',
          'designReview_getScreenMeta',
          'designReview_listSpecFiles',
        ].map((tool) => (
          <div key={tool} style={{ padding: '2px 0' }}>
            <span style={{ color: '#C45353' }}>↳</span> {tool}
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 12,
          padding: 10,
          background: '#FFF9F5',
          borderRadius: 8,
          fontSize: 10,
          color: '#4A4A4A',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 11 }}>
          Run as ACP Agent
        </div>
        <code
          style={{
            display: 'block',
            padding: '6px 8px',
            background: '#FDFBF7',
            borderRadius: 6,
            border: '1px solid #F2EBE0',
            fontSize: 9,
            wordBreak: 'break-all',
          }}
        >
          npx tsx src/acp/agent.ts
        </code>
        <p style={{ marginTop: 6, lineHeight: 1.4 }}>
          Spawn this process from any ACP-compatible client (Claude Code, Zed) to query design review data.
        </p>
      </div>
    </div>
  );
}
