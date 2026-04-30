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
    <div className="flex-1 min-w-[200px] max-w-[340px] bg-bg-surface rounded-2xl p-4 shadow-[0_2px_8px_var(--brand-shadow-light)] self-start max-h-[calc(100vh-80px)] overflow-y-auto">
      {hasStateContext && (
        <div className="mb-3">
          <div className="text-[10px] font-bold uppercase text-brand-solid tracking-[0.5px] mb-1">
            State Context <span style={{ fontWeight: 400, color: '#8A8075' }}>— click a state</span>
          </div>
          <div className="flex flex-col gap-2">
            <StateTabs
              stateContext={meta.stateContext!}
              states={meta.states}
              activeState={activeState}
              onChange={onStateChange}
            />
          </div>
        </div>
      )}

      <div className="mb-3">
        <div className="text-[10px] font-bold uppercase text-brand-solid tracking-[0.5px] mb-1">Description</div>
        <p id="meta-desc" className="text-sm leading-relaxed text-secondary">{description}</p>
      </div>

      {activeCtx?.goal && (
        <div className="mt-2 p-2 bg-[var(--state-goal-bg)] rounded-lg border-l-[3px] border-l-brand-solid">
          <p className="text-xs text-[#6B5E4F] leading-relaxed">{activeCtx.goal}</p>
        </div>
      )}

      <div className="mb-3">
        <div className="text-[10px] font-bold uppercase text-brand-solid tracking-[0.5px] mb-1">Purpose</div>
        <p id="meta-purpose" className="text-sm leading-relaxed text-secondary">{purpose}</p>
      </div>

      <div className="mb-3">
        <div className="text-[10px] font-bold uppercase text-brand-solid tracking-[0.5px] mb-1">Key Elements</div>
        <ul className="list-none p-0 flex flex-wrap gap-[3px]">
          {meta.keyElements.map((el, i) => (
            <li key={i} className="text-xs bg-primary_hover px-2 py-1 rounded-md text-secondary border border-[var(--brand-border-hairline)]">{el}</li>
          ))}
        </ul>
      </div>

      <div className="mb-3">
        <div className="text-[10px] font-bold uppercase text-brand-solid tracking-[0.5px] mb-1">States</div>
        <div className="flex flex-wrap gap-[3px]">
          {meta.states.map((s) => (
            <span key={s} className="text-[10px] px-2 py-[2px] rounded-lg font-semibold bg-[var(--state-success-bg)] text-[var(--state-success-text)]">
              {s}
            </span>
          ))}
        </div>
      </div>

      <div className="mb-3">
        <div className="text-[10px] font-bold uppercase text-brand-solid tracking-[0.5px] mb-1">Interactions</div>
        <div className="flex flex-wrap gap-[3px]">
          {meta.interactions.map((i, idx) => (
            <span key={idx} className="text-[10px] px-2 py-[2px] rounded-lg font-semibold bg-[var(--state-warn-bg)] text-[var(--state-warn-text)]">
              {i}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
