import type { ReactNode } from "react";
import { Camera, ChevronLeft, ChevronRight, ClipboardList, BarChart3, HelpCircle, List } from "./base/icons";

interface BottomBarProps {
  name: string;
  index: number;
  total: number;
  activeTool: string;
  projectName?: string;
  onToolChange: (tool: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onCapture: () => void;
  onSummary: () => void;
  onHelp: () => void;
}

interface ToolDef {
  id: string;
  icon: ReactNode;
  label: string;
  tooltip: string;
  action?: () => void;
}

export function BottomBar({
  name,
  index,
  total,
  activeTool,
  projectName,
  onToolChange,
  onPrev,
  onNext,
  onCapture,
  onSummary,
  onHelp,
}: BottomBarProps) {
  const tools: ToolDef[] = [
    { id: "capture", icon: <Camera size={20} />, label: "Capture", tooltip: "Screenshot current screen", action: onCapture },
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
        <span className="bar-name">{projectName ? `${projectName} / ` : ""}{name}</span>
        <span className="bar-spacer" />
        <button className="bar-nav-btn" onClick={onPrev} disabled={index === 0}>
          <ChevronLeft size={16} />
        </button>
        <span className="bar-pos">
          {index + 1} / {total}
        </span>
        <button className="bar-nav-btn" onClick={onNext}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Tools pill — bottom-center */}
      <div className="pill pill-tools">
        {tools.map((tool) => (
          <button
            key={tool.id}
            className={`dock-tool${activeTool === tool.id ? " active" : ""}`}
            data-tooltip={tool.tooltip}
            onClick={() => handleClick(tool)}
            aria-label={tool.tooltip}
          >
            {tool.icon}
            {activeTool === tool.id ? ` ${tool.label}` : ""}
          </button>
        ))}
      </div>

      {/* Help pill — bottom-right */}
      <div className="pill pill-help">
        <button
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
