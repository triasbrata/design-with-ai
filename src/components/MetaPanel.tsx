import type { ScreenMeta } from '../types';
import { StateTabs } from './StateTabs';

interface MetaPanelProps {
  meta: ScreenMeta | undefined;
  screen: string;
  activeState: string;
  onStateChange: (s: string) => void;
}

export function MetaPanel({ meta, screen, activeState, onStateChange }: MetaPanelProps) {
  if (!meta) return null;

  const hasStateContext = meta.stateContext && Object.keys(meta.stateContext).length > 0;
  const isDefault = activeState === 'default';
  const activeCtx = !isDefault && hasStateContext ? meta.stateContext![activeState] : undefined;

  const description = activeCtx?.description ?? meta.description;
  const purpose = meta.purpose;

  return (
    <div className="meta-panel">
      {hasStateContext && (
        <div className="meta-section">
          <div className="meta-label">State Context <span style={{ fontWeight: 400, color: '#8A8075' }}>— click a state</span></div>
          <div className="meta-row">
            <StateTabs
              stateContext={meta.stateContext!}
              states={meta.states}
              activeState={activeState}
              onChange={onStateChange}
            />
          </div>
        </div>
      )}

      <div className="meta-section">
        <div className="meta-label">Description</div>
        <p id="meta-desc">{description}</p>
      </div>

      <div className="meta-section">
        <div className="meta-label">Purpose</div>
        <p id="meta-purpose">{purpose}</p>
      </div>

      <div className="meta-section">
        <div className="meta-label">Key Elements</div>
        <ul>
          {meta.keyElements.map((el, i) => (
            <li key={i}>{el}</li>
          ))}
        </ul>
      </div>

      <div className="meta-section">
        <div className="meta-label">States</div>
        <div className="chips">
          {meta.states.map((s) => (
            <span key={s} className="chip state">
              {s}
            </span>
          ))}
        </div>
      </div>

      <div className="meta-section">
        <div className="meta-label">Interactions</div>
        <div className="chips">
          {meta.interactions.map((i, idx) => (
            <span key={idx} className="chip interaction">
              {i}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
