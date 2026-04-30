import type { Metadata } from "../types";
import { screenName, TIERS } from "../constants";
import { Button } from "./base";
import { Camera, ArrowLeft } from "./base/icons";

interface SummaryProps {
  screens: string[];
  metadata: Metadata | null;
  onSelect: (screen: string) => void;
  onBack: () => void;
  onCaptureAll: () => void;
}

function getFilename(screen: string, state: string, states: string[]): string {
  const isDefault = state === "default";
  const isFirst = states.length > 0 && state === states[0];
  if (isDefault || isFirst) {
    return `phone_${screen}.png`;
  }
  return `phone_${screen}_${state}.png`;
}

export function Summary({ screens, metadata, onSelect, onBack, onCaptureAll }: SummaryProps) {
  const existing = new Set(screens);

  let totalStates = 0;
  const screenStateMap: Record<string, string[]> = {};

  for (const screen of screens) {
    const metaStates = metadata?.screens[screen]?.states || ["default"];
    screenStateMap[screen] = metaStates;
    totalStates += metaStates.length;
  }

  return (
    <div style={{ width: "100%" }}>
      <div className="toolbar">
        <Button color="secondary" size="sm" onClick={onBack} iconLeading={<ArrowLeft size={18} />}>
          Back
        </Button>
        <span className="name">Summary &mdash; All Screens</span>
        <Button color="primary" size="sm" onClick={onCaptureAll} iconLeading={<Camera size={18} />}>
          Create Baseline ({totalStates} images)
        </Button>
      </div>

      <div style={{ padding: "20px 16px" }}>
        <div className="flex gap-6 mb-5 p-4 bg-bg-surface rounded-[14px] shadow-[0_2px_8px_var(--brand-shadow-light)]">
          <div className="text-center">
            <div className="text-[28px] font-bold text-brand-solid">{screens.length}</div>
            <div className="text-xs text-tertiary">Screens</div>
          </div>
          <div className="text-center">
            <div className="text-[28px] font-bold text-brand-solid">{totalStates}</div>
            <div className="text-xs text-tertiary">States</div>
          </div>
          <div className="text-center">
            <span className="text-[28px] font-bold text-brand-solid">
              phone_{"{screen}"}.png
            </span>
            <div className="text-xs text-tertiary">Naming Convention</div>
          </div>
        </div>

        <table className="w-full border-collapse bg-bg-surface rounded-xl overflow-hidden">
          <thead>
            <tr className="text-left border-b border-[var(--brand-border)]">
              <th className="px-3.5 py-2.5 text-xs text-tertiary">Screen</th>
              <th className="px-3.5 py-2.5 text-xs text-tertiary">States</th>
              <th className="px-3.5 py-2.5 text-xs text-tertiary">State Chips</th>
              <th className="px-3.5 py-2.5 text-xs text-tertiary">Output Files</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(TIERS).flatMap(([tier, info]) => {
              const tierScreens = info.screens.filter((s) => existing.has(s));
              if (!tierScreens.length) return [];

              return [
                <tr key={`tier-${tier}`}>
                  <td colSpan={4} className="text-xs font-bold uppercase text-brand-solid tracking-[0.5px] pt-5 pb-1 px-3.5">
                    {tier} &mdash; {info.label}
                  </td>
                </tr>,
                ...tierScreens.map((screen) => {
                  const states = screenStateMap[screen] || ["default"];

                  return (
                    <tr key={screen}>
                      <td className="px-3.5 py-2 text-sm border-b border-[#F8F4EC]">
                        <a
                          href="#"
                          className="text-brand-solid no-underline hover:underline"
                          onClick={(e) => {
                            e.preventDefault();
                            onSelect(screen);
                          }}
                        >
                          {screenName(screen)}
                        </a>
                      </td>
                      <td className="px-3.5 py-2 text-sm border-b border-[#F8F4EC]">{states.length}</td>
                      <td className="px-3.5 py-2 text-sm border-b border-[#F8F4EC]">
                        {states.map((s) => (
                          <span key={s} className="text-[10px] px-2 py-[2px] rounded-lg bg-primary_hover text-[#5A5A5A] font-semibold whitespace-nowrap">
                            {s}
                          </span>
                        ))}
                      </td>
                      <td className="px-3.5 py-2 text-sm border-b border-[#F8F4EC]">
                        {states.map((s) => (
                          <code key={s} className="text-[9px] bg-[#F9F6EE] px-1.5 py-[1px] rounded text-tertiary">{getFilename(screen, s, states)}</code>
                        ))}
                      </td>
                    </tr>
                  );
                }),
              ];
            })}
          </tbody>
        </table>

        <p className="text-[9px] text-[var(--brand-muted-light)] text-center pb-2 mt-4">
          Use arrow keys or Tab to navigate screens. Press \ to toggle the sidebar.
        </p>
      </div>
    </div>
  );
}
