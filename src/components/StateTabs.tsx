import type { StateContext } from '../types';

interface StateTabsProps {
  stateContext: Record<string, StateContext>;
  states: string[];
  activeState: string;
  onChange: (s: string) => void;
}

export function StateTabs({ stateContext, states, activeState, onChange }: StateTabsProps) {
  const availableStates =
    states.length > 0
      ? states.filter((s) => s in stateContext)
      : Object.keys(stateContext);

  return (
    <>
      <div className="state-tabs">
        <button
          type="button"
          className={`state-tab${activeState === 'default' ? ' active' : ''}`}
          onClick={() => onChange('default')}
        >
          Overview
        </button>
        {availableStates.map((s) => (
          <button
            type="button"
            key={s}
            className={`state-tab${activeState === s ? ' active' : ''}`}
            onClick={() => onChange(s)}
          >
            {stateContext[s].label}
          </button>
        ))}
      </div>
      <div id="state-goal" className={activeState === 'default' ? 'hidden' : ''}>
        {activeState !== 'default' && stateContext[activeState]?.goal && (
          <>
            <div className="meta-label">Goal</div>
            <p id="state-goal-text">{stateContext[activeState].goal}</p>
          </>
        )}
      </div>
    </>
  );
}
