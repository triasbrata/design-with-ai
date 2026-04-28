import type { Metadata } from '../types';
import { screenName, TIERS } from '../constants';

interface SummaryProps {
  screens: string[];
  metadata: Metadata | null;
  onSelect: (screen: string) => void;
  onBack: () => void;
  onCaptureAll: () => void;
}

function getFilename(screen: string, state: string, states: string[]): string {
  const isDefault = state === 'default';
  const isFirst = states.length > 0 && state === states[0];
  if (isDefault || isFirst) {
    return `phone_${screen}.png`;
  }
  return `phone_${screen}_${state}.png`;
}

export function Summary({
  screens,
  metadata,
  onSelect,
  onBack,
  onCaptureAll,
}: SummaryProps) {
  const existing = new Set(screens);

  let totalStates = 0;
  const screenStateMap: Record<string, string[]> = {};

  for (const screen of screens) {
    const metaStates = metadata?.screens[screen]?.states || ['default'];
    screenStateMap[screen] = metaStates;
    totalStates += metaStates.length;
  }

  return (
    <div style={{ width: '100%' }}>
      <div className="toolbar">
        <button className="nav-btn" onClick={onBack} title="Back">
          &#9664;
        </button>
        <span className="name">Summary &mdash; All Screens</span>
        <button className="capture-btn" onClick={onCaptureAll}>
          &#128247; Create Baseline ({totalStates} images)
        </button>
      </div>

      <div style={{ padding: '20px 16px' }}>
        <div className="summary-stats">
          <div className="summary-stat">
            <div className="num">{screens.length}</div>
            <div className="lbl">Screens</div>
          </div>
          <div className="summary-stat">
            <div className="num">{totalStates}</div>
            <div className="lbl">States</div>
          </div>
          <div className="summary-stat">
            <code className="num" style={{ fontSize: '16px' }}>
              phone_&#123;screen&#125;.png
            </code>
            <div className="lbl">Naming Convention</div>
          </div>
        </div>

        <table className="summary-table">
          <thead>
            <tr>
              <th>Screen</th>
              <th>States</th>
              <th>State Chips</th>
              <th>Output Files</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(TIERS).flatMap(([tier, info]) => {
              const tierScreens = info.screens.filter((s) => existing.has(s));
              if (!tierScreens.length) return [];

              return [
                <tr className="tier-header" key={`tier-${tier}`}>
                  <td colSpan={4}>
                    {tier} &mdash; {info.label}
                  </td>
                </tr>,
                ...tierScreens.map((screen) => {
                  const states = screenStateMap[screen] || ['default'];

                  return (
                    <tr key={screen}>
                      <td>
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            onSelect(screen);
                          }}
                        >
                          {screenName(screen)}
                        </a>
                      </td>
                      <td>{states.length}</td>
                      <td>
                        {states.map((s) => (
                          <span className="sum-chip" key={s}>
                            {s}
                          </span>
                        ))}
                      </td>
                      <td className="sum-files">
                        {states.map((s) => (
                          <code key={s}>{getFilename(screen, s, states)}</code>
                        ))}
                      </td>
                    </tr>
                  );
                }),
              ];
            })}
          </tbody>
        </table>

        <p className="shortcut-hint" style={{ marginTop: '16px' }}>
          Use arrow keys or Tab to navigate screens. Press \ to toggle the sidebar.
        </p>
      </div>
    </div>
  );
}
