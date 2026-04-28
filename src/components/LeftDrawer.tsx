import { useEffect, useRef, useMemo } from "react";
import { Menu, CheckCircle2, Loader2 } from "./base/icons";
import type { Metadata } from "../types";
import { TIERS } from "../constants";

interface LeftDrawerProps {
  open: boolean;
  onToggle: () => void;
  metadata: Metadata | null;
}

export function LeftDrawer({ open, onToggle, metadata }: LeftDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onToggle();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onToggle]);

  const workspace = useMemo(() => {
    if (!metadata) return null;
    const existing = new Set(Object.keys(metadata.screens));
    const tierBreakdown = Object.entries(TIERS).map(([tier, info]) => {
      const count = info.screens.filter((s) => existing.has(s)).length;
      return { tier, label: info.label, count };
    });
    const totalInTiers = tierBreakdown.reduce((s, t) => s + t.count, 0);
    const unlisted = existing.size - totalInTiers;
    return {
      version: metadata.meta.version,
      lastUpdated: metadata.meta.lastUpdated,
      totalScreens: metadata.meta.totalScreens,
      components: Object.keys(metadata.components).length,
      tierBreakdown,
      unlisted,
    };
  }, [metadata]);

  return (
    <>
      {/* Trigger button — top-left below burger */}
      <div className="left-drawer-trigger">
        <button className="burger-btn" onClick={onToggle} aria-label="Toggle workspace">
          <Menu size={18} />
        </button>
      </div>

      {/* Drawer panel — slides from left */}
      <aside ref={drawerRef} className={`left-drawer${open ? " open" : ""}`}>
        <div className="left-drawer-inner">
          {workspace ? (
            <>
              <h3>MoneyKitty</h3>
              <p className="sub">Design Review Workspace</p>

              <div className="ws-section">
                <div className="ws-label">Version</div>
                <div className="ws-value">{workspace.version}</div>
              </div>
              <div className="ws-section">
                <div className="ws-label">Last Updated</div>
                <div className="ws-value">{workspace.lastUpdated}</div>
              </div>

              <div className="ws-divider" />

              <div className="ws-section">
                <div className="ws-label">Screens</div>
                <div className="ws-value ws-num">{workspace.totalScreens}</div>
              </div>
              {workspace.tierBreakdown.map((t) =>
                t.count > 0 ? (
                  <div className="ws-tier" key={t.tier}>
                    <span className="ws-tier-label">{t.tier}</span>
                    <span className="ws-tier-bar">
                      <span className="ws-tier-fill" style={{ width: `${(t.count / workspace.totalScreens) * 100}%` }} />
                    </span>
                    <span className="ws-tier-count">{t.count}</span>
                  </div>
                ) : null
              )}
              {workspace.unlisted > 0 && (
                <div className="ws-tier">
                  <span className="ws-tier-label">Other</span>
                  <span className="ws-tier-count">{workspace.unlisted}</span>
                </div>
              )}

              <div className="ws-divider" />

              <div className="ws-section">
                <div className="ws-label">Components</div>
                <div className="ws-value ws-num">{workspace.components}</div>
              </div>

              <div className="ws-status">
                <CheckCircle2 size={14} />
                <span>Workspace ready</span>
              </div>
            </>
          ) : (
            <>
              <h3>Workspace</h3>
              <p className="sub">Loading workspace data...</p>
              <div className="ws-loading">
                <Loader2 size={18} className="animate-spin" />
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
