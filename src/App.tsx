import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useScreens } from "./hooks/useScreens";
import { useProjects } from "./hooks/useProjects";
import { useToast } from "./hooks/useToast";
import { useAcpBridge } from "./acp/useAcpBridge";
import { DrawerTabs } from "./acp/DrawerTabs";
import { Viewer } from "./components/Viewer";
import { Summary } from "./components/Summary";
import { CaptureProgress } from "./components/CaptureProgress";
import { BottomBar } from "./components/BottomBar";
import { LeftDrawer } from "./components/LeftDrawer";
import { RightDrawer } from "./components/RightDrawer";
import { HelpModal } from "./components/HelpModal";
import { Toast } from "./components/Toast";
import { screenName, DEVICE_PRESETS, DEVICE_CYCLE } from "./constants";
import type { DeviceMode } from "./constants";
import type { CaptureResult, ClientProject, MarkerRect, MarkerContext } from "./types";
import { extractMarkedContext } from "./acp/extractMarkerContext";


declare global {
  interface Window {
    html2canvas: (element: HTMLElement, options?: Record<string, unknown>) => Promise<HTMLCanvasElement>;
  }
}

export default function App() {
  const {
    projects,
    activeIndex,
    activeProject,
    activeFolder,
    activeInputDir,
    activeOutputDir,
    addProject,
    addFolderToWorkspace,
    removeProject,
    removeFolder,
    setActive,
  } = useProjects();

  const { toast, show } = useToast();

  // Pre-built file URL map for client projects
  const projectFileMap = useMemo(() => {
    if (activeProject?.type !== "client") return null;
    const map: Record<string, string> = {};
    for (const f of activeProject.files) {
      const key = f.name.replace(/\.html$/, "");
      map[key] = f.blobUrl;
    }
    return map;
  }, [activeProject]);

  // Resolve screen URLs: workspace (inputDir) → Vite middleware, client → blob URL
  const getScreenUrl = useCallback(
    (screen: string, state?: string): string => {
      if (activeProject?.type === "workspace") {
        if (state) {
          return `/screens/${screen}_${state}.html?dir=${encodeURIComponent(activeInputDir)}`;
        }
        return `/screens/${screen}.html?dir=${encodeURIComponent(activeInputDir)}`;
      }
      // Client project
      if (!projectFileMap) return "";
      if (state && projectFileMap[`${screen}_${state}`]) {
        return projectFileMap[`${screen}_${state}`];
      }
      return projectFileMap[screen] ?? "";
    },
    [activeProject, activeInputDir, projectFileMap],
  );

  // Save capture: workspace → POST to outputDir, client → no-op
  const saveCapture = useCallback(
    async (filename: string, dataUrl: string): Promise<CaptureResult> => {
      if (activeProject?.type === "client") {
        return { filename, ok: true };
      }
      try {
        const res = await fetch(`/api/capture?dir=${encodeURIComponent(activeOutputDir)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename, data: dataUrl }),
        });
        const result = await res.json();
        if (!result.ok) {
          return { filename, ok: false, error: result.error || "save failed" };
        }
        return { filename, ok: true };
      } catch (err) {
        return { filename, ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
    [activeProject, activeOutputDir],
  );

  // Pre-loaded metadata for client projects (skip fetch)
  const preloadedMetadata = activeProject?.type === "client"
    ? (activeProject as ClientProject).metadata
    : undefined;

  const {
    metadata,
    orderedScreens,
    currentIndex,
    currentScreen,
    total,
    isSummary,
    navigate,
    goNext,
    goPrev,
    goHome,
    queryState,
  } = useScreens(activeInputDir, preloadedMetadata);

  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
  const [leftPinned, setLeftPinned] = useState(false);
  const [rightPinned, setRightPinned] = useState(false);
  const [activeState, setActiveState] = useState(queryState || "default");
  const isFirstRender = useRef(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [dockTool, setDockTool] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [markerRect, setMarkerRect] = useState<MarkerRect | null>(null);
  const [markerContext, setMarkerContext] = useState<MarkerContext | null>(null);
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("phone-v");

  // Sync CSS custom properties when device mode changes
  useEffect(() => {
    const preset = DEVICE_PRESETS[deviceMode];
    document.documentElement.style.setProperty("--phone-width", `${preset.width}px`);
    document.documentElement.style.setProperty("--phone-height", `${preset.height}px`);
  }, [deviceMode]);

  const acpState = useAcpBridge({
    currentScreen,
    activeState,
    totalScreens: total,
  });

  const screenMeta = metadata?.screens?.[currentScreen];
  const screenStates = screenMeta?.states || ["default"];

  const markerMode = dockTool === "marker";
  const projectLabel =
    activeProject?.type === "workspace" && activeFolder
      ? `${activeProject.name} / ${activeFolder.name}`
      : activeProject?.name ?? "";

  // Reset activeState when currentScreen changes (skip initial mount — URL state rules)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setActiveState("default");
  }, [currentScreen]);

  // Sync activeState back to URL so direct-link / refresh preserves the state
  useEffect(() => {
    if (!currentScreen || isSummary) return;
    const params = new URLSearchParams(location.search);
    if (activeState && activeState !== "default") {
      params.set("state", activeState);
    } else {
      params.delete("state");
    }
    history.replaceState({}, "", `?${params.toString()}`);
  }, [currentScreen, activeState, isSummary]);

  // Reset marker on screen change
  useEffect(() => {
    setMarkerRect(null);
    setMarkerContext(null);
  }, [currentScreen]);


  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Device mode shortcuts: Meta/Ctrl + 1-5
      if ((e.metaKey || e.ctrlKey) && /^[1-5]$/.test(e.key)) {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        setDeviceMode(DEVICE_CYCLE[idx]);
        return;
      }

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          goPrev();
          break;
        case "ArrowRight":
          e.preventDefault();
          goNext();
          break;
        case "Escape":
          e.preventDefault();
          if (markerRect) {
            setMarkerRect(null);
            setMarkerContext(null);
          } else {
            goHome();
          }
          break;
        case "\\":
          e.preventDefault();
          setLeftDrawerOpen((prev) => !prev);
          break;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goPrev, goNext, goHome, markerRect]);

  // Capture the current screen with its active state
  const handleCapture = useCallback(async () => {
    const iframe = document.getElementById("phone-frame") as HTMLIFrameElement | null;
    if (!iframe?.contentDocument?.body) {
      show("No iframe content to capture", false);
      return;
    }

    const states = metadata?.screens?.[currentScreen]?.states || ["default"];
    const isDefaultState = activeState === states[0] || states.length <= 1;
    const filename = isDefaultState
      ? `phone_${currentScreen}.png`
      : `phone_${currentScreen}_${activeState}.png`;

    try {
      if (typeof window.html2canvas !== "function") {
        show("html2canvas not loaded", false);
        return;
      }

      const preset = DEVICE_PRESETS[deviceMode];
      const canvas = await window.html2canvas(iframe.contentDocument.body, {
        width: preset.width,
        height: preset.height,
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: true,
      });
      const dataUrl = canvas.toDataURL("image/png");

      // Trigger download via anchor click (works for both project types)
      const link = document.createElement("a");
      link.download = filename;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // For workspace projects: POST to save on server
      if (activeProject?.type !== "client") {
        try {
          const res = await fetch(`/api/capture?dir=${encodeURIComponent(activeOutputDir)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename, data: dataUrl }),
          });
          const result = await res.json();
          if (result.ok) {
            show(`Saved: ${result.path}`, true);
          } else {
            show(`Save failed: ${result.error}`, false);
          }
        } catch {
          show("Captured locally but upload failed", false);
        }
      } else {
        show(`Downloaded: ${filename}`, true);
      }
    } catch {
      show("Capture failed", false);
    }
  }, [currentScreen, activeState, metadata, show, activeOutputDir, activeProject, deviceMode]);

  // Start batch capture of all screens
  const handleCaptureAll = useCallback(() => {
    setCapturing(true);
  }, []);

  // Called when CaptureProgress finishes
  const handleCaptureAllDone = useCallback(
    (results: CaptureResult[]) => {
      setCapturing(false);
      const okCount = results.filter((r) => r.ok).length;
      const failCount = results.filter((r) => !r.ok).length;
      const msg =
        failCount > 0
          ? `${okCount} succeeded, ${failCount} failed`
          : `All ${okCount} captured`;
      show(msg, failCount === 0);
      navigate("summary");
    },
    [show, navigate],
  );

  // Handle dock tool button clicks
  const handleDockTool = useCallback(
    (tool: string) => {
      if (tool === dockTool) {
        // Toggle off — clear marker if marker tool
        if (tool === "marker") {
          setMarkerRect(null);
          setMarkerContext(null);
        }
        setDockTool("");
        return;
      }
      setDockTool(tool);
      switch (tool) {
        case "capture":
          handleCapture();
          break;
        case "summary":
          navigate("summary");
          setDockTool("");
          break;
        case "help":
          setHelpOpen(true);
          break;
        default:
          break;
      }
    },
    [dockTool, handleCapture, navigate],
  );

  // Update active state when Viewer requests a state change
  const handleStateChange = useCallback((_screen: string, state: string) => {
    setActiveState(state);
  }, []);

  // Handle marker placement from MarkerOverlay
  const handleMark = useCallback(
    (payload: { rect: MarkerRect; screen: string; state: string }) => {
      setMarkerRect(payload.rect);
      // Auto-extract context from iframe
      const iframe = document.getElementById('phone-frame') as HTMLIFrameElement | null;
      const ctx = extractMarkedContext(
        payload.screen,
        payload.state,
        payload.rect,
        iframe?.contentDocument ?? null,
      );
      if (ctx) setMarkerContext(ctx);
    },
    [],
  );

  // Reset marker state
  const handleResetMarker = useCallback(() => {
    setMarkerRect(null);
    setMarkerContext(null);
  }, []);

  // Set device mode directly, or cycle to next if no mode provided
  const handleDeviceModeCycle = useCallback((mode?: DeviceMode) => {
    if (mode) {
      setDeviceMode(mode);
    } else {
      setDeviceMode((prev) => {
        const idx = DEVICE_CYCLE.indexOf(prev);
        return DEVICE_CYCLE[(idx + 1) % DEVICE_CYCLE.length];
      });
    }
  }, []);

  // Quick-add workspace from left drawer inline form
  const handleAddWorkspace = useCallback((name: string) => {
    addProject({
      type: "workspace",
      name: name.trim(),
      folders: [{ name: "Main", inputDir: "", outputDir: "" }],
      activeFolder: 0,
    });
  }, [addProject]);

  // Add folder to workspace (from plus button or context menu)
  const handleAddFolder = useCallback(
    (workspaceIdx: number, name: string, inputDir: string, outputDir: string) => {
      addFolderToWorkspace(workspaceIdx, {
        name,
        inputDir,
        outputDir: outputDir || inputDir,
      });
    },
    [addFolderToWorkspace],
  );

  // Empty state
  if (orderedScreens.length === 0) {
    return (
      <div className="main-content" style={{ padding: "40px", textAlign: "center" }}>
        <p style={{ color: "var(--brand-muted)", marginTop: 24 }}>
          No screens found. Press \ to open workspace drawer and add a project.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden" }}>
      {capturing ? (
        <CaptureProgress
          screens={orderedScreens}
          metadata={metadata!}
          getScreenUrl={getScreenUrl}
          saveCapture={saveCapture}
          onDone={handleCaptureAllDone}
          deviceMode={deviceMode}
        />
      ) : (
        <>
          <LeftDrawer
            open={leftDrawerOpen}
            onToggle={() => setLeftDrawerOpen((p) => !p)}
            pinned={leftPinned}
            onPinToggle={() => setLeftPinned((p) => !p)}
            projects={projects}
            activeIndex={activeIndex}
            activeFolderIdx={
              activeProject?.type === "workspace" ? activeProject.activeFolder : 0
            }
            screens={orderedScreens}
            activeScreen={currentScreen}
            onSelect={navigate}
            onSetActive={setActive}
            onAddWorkspace={handleAddWorkspace}
            onAddFolder={handleAddFolder}
            onRemoveProject={removeProject}
          />
          <div className="content-area">
            <div className="main-content">
              {isSummary ? (
                <Summary
                  screens={orderedScreens}
                  metadata={metadata}
                  onSelect={navigate}
                  onBack={goPrev}
                  onCaptureAll={handleCaptureAll}
                />
              ) : (
                <Viewer
                  screen={currentScreen}
                  index={currentIndex}
                  total={total}
                  metadata={metadata}
                  getScreenUrl={getScreenUrl}
                  activeState={activeState}
                  onSelectScreen={navigate}
                  onPrev={goPrev}
                  onNext={goNext}
                  onStateChange={handleStateChange}
                  markerMode={markerMode}
                  markerRect={markerRect}
                  onMark={handleMark}
                />
              )}
            </div>
          </div>
          <RightDrawer
            open={rightDrawerOpen}
            onToggle={() => setRightDrawerOpen((p) => !p)}
            pinned={rightPinned}
            onPinToggle={() => setRightPinned((p) => !p)}
          >
            <DrawerTabs
              connected={acpState.connected}
              currentScreen={currentScreen}
              markerContext={markerContext}
              onResetMarker={handleResetMarker}
            />
          </RightDrawer>
          {!isSummary && (
            <BottomBar
              name={screenName(currentScreen)}
              index={currentIndex}
              total={total}
              activeTool={dockTool}
              projectName={projectLabel}
              deviceMode={deviceMode}
              onToolChange={handleDockTool}
              onPrev={goPrev}
              onNext={goNext}
              onCapture={handleCapture}
              onSummary={() => {
                goNext();
                setDockTool("");
              }}
              onHelp={() => setHelpOpen(true)}
              onDeviceModeChange={handleDeviceModeCycle}
            />
          )}
          <HelpModal show={helpOpen} onClose={() => setHelpOpen(false)} />
          <Toast message={toast.message} visible={toast.visible} ok={toast.ok} />
        </>
      )}
    </div>
  );
}
