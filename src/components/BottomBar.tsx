import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { Camera, ChevronLeft, ChevronRight, ClipboardList, BarChart3, HelpCircle, List, Smartphone, Square, Monitor, Tablet } from "./base/icons";
import { DEVICE_PRESETS } from "../constants";
import type { DeviceMode } from "../constants";

interface BottomBarProps {
  name: string;
  index: number;
  total: number;
  activeTool: string;
  projectName?: string;
  deviceMode: DeviceMode;
  onToolChange: (tool: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onCapture: () => void;
  onSummary: () => void;
  onHelp: () => void;
  onDeviceModeChange: (mode: DeviceMode) => void;
}

interface ToolDef {
  id: string;
  icon: ReactNode;
  label: string;
  tooltip: string;
  action?: () => void;
}

function NameDisplay({ projectName, name }: { projectName?: string; name: string }) {
  const full = projectName ? `${projectName} / ${name}` : name;
  const display = name.length > 20 ? name.slice(0, 20) + "..." : name;

  return <span className="text-sm font-semibold" title={full}>{display}</span>;
}

const dockToolBase = cn(
  "group relative font-[family-name:var(--font-family)] text-base px-3 py-2 rounded-2xl border-none bg-transparent text-tertiary cursor-pointer transition-all duration-200 whitespace-nowrap flex items-center gap-1.5 leading-none",
  "after:content-[attr(data-tooltip)] after:absolute after:bottom-[calc(100%+8px)] after:left-1/2 after:-translate-x-1/2 after:bg-[var(--brand-text)] after:text-white after:text-xs after:font-medium after:px-2.5 after:py-1.5 after:rounded-lg after:whitespace-nowrap after:pointer-events-none after:opacity-0 after:transition-opacity after:duration-150",
  "hover:after:opacity-100",
  "hover:bg-primary_hover hover:text-[var(--brand-text)]",
);

const pillBase = cn(
  "fixed bottom-3 z-[var(--z-pills)] bg-bg-surface border border-[var(--brand-border)] rounded-[20px] shadow-[0_4px_16px_var(--brand-shadow-heavy)] min-h-12 flex items-center px-4 py-1.5",
  "max-[900px]:px-2 max-[900px]:py-1.5 max-[900px]:min-h-10",
);

export function BottomBar({
  name,
  index,
  total,
  activeTool,
  projectName,
  deviceMode,
  onToolChange,
  onPrev,
  onNext,
  onCapture,
  onSummary,
  onHelp,
  onDeviceModeChange,
}: BottomBarProps) {
  function deviceIcon(mode: DeviceMode): ReactNode {
    const size = 14;
    if (mode.startsWith("phone")) return <Smartphone size={size} />;
    if (mode.startsWith("tablet")) return <Tablet size={size} />;
    return <Monitor size={size} />;
  }

  const deviceLabel = DEVICE_PRESETS[deviceMode].label;
  const [deviceMenuOpen, setDeviceMenuOpen] = useState(false);
  const deviceMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!deviceMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (deviceMenuRef.current && !deviceMenuRef.current.contains(e.target as Node)) {
        setDeviceMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [deviceMenuOpen]);

  const tools: ToolDef[] = [
    { id: "marker", icon: <Square size={20} />, label: "Marker", tooltip: "Draw rectangle marker on screen" },
    { id: "capture", icon: <Camera size={20} />, label: "Capture", tooltip: "Screenshot current screen", action: onCapture },
    { id: "device", icon: deviceIcon(deviceMode), label: deviceLabel, tooltip: `Device: ${deviceLabel}` },
    { id: "states", icon: <List size={20} />, label: "States", tooltip: "Toggle state view" },
    { id: "summary", icon: <ClipboardList size={20} />, label: "Summary", tooltip: "View all screens summary", action: onSummary },
    { id: "export", icon: <BarChart3 size={20} />, label: "Export", tooltip: "Export screenshots" },
  ];

  function handleClick(tool: ToolDef) {
    if (activeTool === tool.id) {
      onToolChange("");
    } else {
      onToolChange(tool.id);
      if (tool.action) tool.action();
    }
  }

  return (
    <>
      {/* Info + nav pill — bottom-left */}
      <div className={cn(pillBase, "left-4 gap-1.5 whitespace-nowrap max-[900px]:left-2")}>
        <NameDisplay projectName={projectName} name={name} />
        <span className="w-10" />
        <button type="button" className="font-[family-name:var(--font-family)] w-6 h-6 rounded-md border-none bg-primary_hover text-[var(--brand-text)] text-xs cursor-pointer flex items-center justify-center transition-[background] duration-150 p-0 hover:bg-[var(--brand-border-hairline)] disabled:opacity-50 disabled:cursor-default" onClick={onPrev} disabled={index === 0}>
          <ChevronLeft size={16} />
        </button>
        <span className="text-xs text-tertiary">
          {index + 1} / {total}
        </span>
        <button type="button" className="font-[family-name:var(--font-family)] w-6 h-6 rounded-md border-none bg-primary_hover text-[var(--brand-text)] text-xs cursor-pointer flex items-center justify-center transition-[background] duration-150 p-0 hover:bg-[var(--brand-border-hairline)] disabled:opacity-50 disabled:cursor-default" onClick={onNext}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Tools pill — bottom-center */}
      <div className={cn(pillBase, "left-1/2 -translate-x-1/2 gap-0.5 px-2 py-1.5 max-[900px]:gap-[1px] max-[900px]:px-1 max-[900px]:py-1.5")} role="toolbar">
        {tools.map((tool) => {
          if (tool.id === "device") {
            return (
              <div className="relative" ref={deviceMenuRef} key="device">
                <button
                  type="button"
                  className={cn(dockToolBase, "bg-[var(--brand-accent-light)] text-brand-solid font-semibold text-xs px-3.5 py-1.5")}
                  data-tooltip={tool.tooltip}
                  onClick={() => setDeviceMenuOpen((prev) => !prev)}
                  aria-label={tool.tooltip}
                >
                  {tool.icon}
                  {` ${tool.label}`}
                </button>
                {deviceMenuOpen && (
                  <div className="absolute bottom-full right-0 mb-2 bg-bg-surface border border-[var(--brand-border)] rounded-xl shadow-[0_4px_16px_var(--brand-shadow)] p-1 min-w-[200px] max-w-[calc(100vw-32px)] z-[var(--z-dropdown)]">
                    {(Object.keys(DEVICE_PRESETS) as DeviceMode[]).map((mode) => {
                      const preset = DEVICE_PRESETS[mode];
                      return (
                        <button
                          type="button"
                          key={mode}
                          className={cn(
                            "flex w-full items-center justify-between gap-2 px-3 py-2 border-none rounded-lg bg-transparent text-[var(--brand-text)] font-inherit text-sm cursor-pointer whitespace-nowrap",
                            mode === deviceMode ? "bg-brand-solid text-white" : "hover:bg-primary_hover"
                          )}
                          onClick={() => {
                            onDeviceModeChange(mode);
                            setDeviceMenuOpen(false);
                          }}
                        >
                          <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            {deviceIcon(mode)}
                            <span style={{ whiteSpace: "nowrap" }}>{preset.label}</span>
                          </span>
                          <span className={cn("text-xs ml-3 whitespace-nowrap shrink-0", mode === deviceMode ? "text-white/70" : "text-tertiary")}>{preset.shortcut}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }
          return (
            <button
              type="button"
              key={tool.id}
              className={cn(
                dockToolBase,
                activeTool === tool.id && "bg-[var(--brand-accent-light)] text-brand-solid font-semibold text-xs px-3.5 py-1.5"
              )}
              data-tooltip={tool.tooltip}
              onClick={() => handleClick(tool)}
              aria-label={tool.tooltip}
            >
              {tool.icon}
              {activeTool === tool.id ? ` ${tool.label}` : ""}
            </button>
          );
        })}
      </div>

      {/* Help pill — bottom-right */}
      <div className={cn(pillBase, "right-4 px-2 py-1.5 max-[900px]:right-2")}>
        <button
          type="button"
          className={cn(
            dockToolBase,
            activeTool === "help" && "bg-[var(--brand-accent-light)] text-brand-solid font-semibold text-xs px-3.5 py-1.5"
          )}
          data-tooltip="Keyboard shortcuts"
          onClick={() => {
            if (activeTool === "help") onToolChange("");
            else {
              onToolChange("help");
              onHelp();
            }
          }}
          aria-label="Keyboard shortcuts"
        >
          <HelpCircle size={20} />
          {activeTool === "help" ? " Help" : ""}
        </button>
      </div>
    </>
  );
}
