import { SectionHeaders } from "./application/section-headers/section-headers";
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

  const items = [
    { id: "default", label: "Overview" },
    ...availableStates.map((s) => ({ id: s, label: stateContext[s].label })),
  ];

  return (
    <SectionHeaders
      items={items}
      activeId={activeState}
      onChange={onChange}
      size="sm"
      variant="pills"
    />
  );
}
