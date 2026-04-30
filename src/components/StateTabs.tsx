import { cn } from "../lib/cn";
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
      <div className="flex flex-wrap gap-[3px] mb-1.5">
        <button
          type="button"
          className={cn(
            "text-xs font-semibold px-[10px] py-[3px] rounded-[10px] border border-[var(--brand-border-hairline)] bg-white text-tertiary cursor-pointer transition-all duration-150",
            activeState === 'default' ? "bg-brand-solid text-white border-brand-solid" : "hover:bg-primary_hover hover:text-secondary"
          )}
          onClick={() => onChange('default')}
        >
          Overview
        </button>
        {availableStates.map((s) => (
          <button
            type="button"
            key={s}
            className={cn(
              "text-xs font-semibold px-[10px] py-[3px] rounded-[10px] border border-[var(--brand-border-hairline)] bg-white text-tertiary cursor-pointer transition-all duration-150",
              activeState === s ? "bg-brand-solid text-white border-brand-solid" : "hover:bg-primary_hover hover:text-secondary"
            )}
            onClick={() => onChange(s)}
          >
            {stateContext[s].label}
          </button>
        ))}
      </div>
      <div className={cn(activeState === 'default' && "!hidden")}>
        {activeState !== 'default' && stateContext[activeState]?.goal && (
          <>
            <div className="text-xs font-bold uppercase text-brand-solid tracking-[0.5px] mb-1">
              Goal
            </div>
            <p id="state-goal-text" className="text-xs text-[#6B5E4F] leading-relaxed">
              {stateContext[activeState].goal}
            </p>
          </>
        )}
      </div>
    </>
  );
}
