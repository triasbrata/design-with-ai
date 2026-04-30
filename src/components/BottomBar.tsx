import { useEffect, useRef, useState, type ReactNode } from "react";
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

  return <span className="bar-name" title={full}>{display}</span>;
}

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
      <div className="pill pill-info">
        <NameDisplay projectName={projectName} name={name} />
        <span className="bar-spacer" />
        <button type="button" className="bar-nav-btn" onClick={onPrev} disabled={index === 0}>
          <ChevronLeft size={16} />
        </button>
        <span className="bar-pos">
          {index + 1} / {total}
        </span>
        <button type="button" className="bar-nav-btn" onClick={onNext}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Tools pill — bottom-center */}
      <div className="pill pill-tools" role="toolbar">
        {tools.map((tool) => {
          if (tool.id === "device") {
            return (
              <div className="device-menu-wrapper" ref={deviceMenuRef} key="device">
                <button
                  type="button"
                  className="dock-tool active"
                  data-tooltip={tool.tooltip}
                  onClick={() => setDeviceMenuOpen((prev) => !prev)}
                  aria-label={tool.tooltip}
                >
                  {tool.icon}
                  {` ${tool.label}`}
                </button>
                {deviceMenuOpen && (
                  <div className="device-dropdown">
                    {(Object.keys(DEVICE_PRESETS) as DeviceMode[]).map((mode) => {
                      const preset = DEVICE_PRESETS[mode];
                      return (
                        <button
                          type="button"
                          key={mode}
                          className={`device-option${mode === deviceMode ? " active" : ""}`}
                          onClick={() => {
                            onDeviceModeChange(mode);
                            setDeviceMenuOpen(false);
                          }}
                        >
                          <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            {deviceIcon(mode)}
                            <span style={{ whiteSpace: "nowrap" }}>{preset.label}</span>
                          </span>
                          <span className="device-shortcut">{preset.shortcut}</span>
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
              className={`dock-tool${activeTool === tool.id ? " active" : ""}`}
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
      <div className="pill pill-help">
        <button
          type="button"
          className={`dock-tool${activeTool === "help" ? " active" : ""}`}
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
