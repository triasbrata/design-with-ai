import { useEffect, useRef } from "react";
import { screenName, TIERS } from "../constants";
import type { TierInfo } from "../types";
import { Menu } from "./base/icons";

interface ScreenMenuProps {
  screens: string[];
  activeScreen: string;
  onSelect: (screen: string) => void;
  open: boolean;
  onToggle: () => void;
}

export function ScreenMenu({ screens, activeScreen, onSelect, open, onToggle }: ScreenMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onToggle();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onToggle]);

  const existing = new Set(screens);

  function renderTierRows(tier: string, info: TierInfo) {
    const tierScreens = info.screens.filter((s) => existing.has(s));
    if (!tierScreens.length) return null;
    return (
      <div className="tier-group" key={tier}>
        <div className="tier-label">
          {tier} &mdash; {info.label}
        </div>
        {tierScreens.map((s) => (
          <button
            key={s}
            className={`side-link${s === activeScreen ? " active" : ""}`}
            onClick={() => {
              onSelect(s);
              onToggle();
            }}
            title={screenName(s)}
          >
            {screenName(s)}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div data-caid="screen-menu" className="menu-wrapper" ref={menuRef}>
      <button className="burger-btn" onClick={onToggle} aria-label="Screens menu">
        <Menu size={18} />
      </button>
      {open && (
        <div className="menu-dropdown">
          <h3>Design Review</h3>
          <p className="sub">{screens.length} screens</p>
          {Object.entries(TIERS).map(([tier, info]) => renderTierRows(tier, info))}
        </div>
      )}
    </div>
  );
}
