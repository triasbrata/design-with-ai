import { useState, useEffect, useCallback, useMemo } from "react";
import { useScreens } from "./hooks/useScreens";
import { useProjects } from "./hooks/useProjects";
import { useToast } from "./hooks/useToast";
import { Viewer } from "./components/Viewer";
import { Summary } from "./components/Summary";
import { CaptureProgress } from "./components/CaptureProgress";
import { BottomBar } from "./components/BottomBar";
import { LeftDrawer } from "./components/LeftDrawer";
import { RightDrawer } from "./components/RightDrawer";
import { HelpModal } from "./components/HelpModal";
import { ProjectSelector } from "./components/ProjectSelector";
import { Toast } from "./components/Toast";
import { screenName } from "./constants";
import type { CaptureResult, ClientProject } from "./types";

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
  } = useScreens(activeInputDir, preloadedMetadata);

  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
  const [activeState, setActiveState] = useState("default");
  const [helpOpen, setHelpOpen] = useState(false);
  const [dockTool, setDockTool] = useState("");
  const [capturing, setCapturing] = useState(false);

  const screenMeta = metadata?.screens?.[currentScreen];
  const screenStates = screenMeta?.states || ["default"];

  // Build project label for BottomBar
  const projectLabel =
    activeProject?.type === "workspace" && activeFolder
      ? `${activeProject.name} / ${activeFolder.name}`
      : activeProject?.name ?? "";

  // Reset activeState when currentScreen changes
  useEffect(() => {
    setActiveState("default");
  }, [currentScreen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

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
          goHome();
          break;
        case "\\":
          e.preventDefault();
          setRightDrawerOpen((prev) => !prev);
          break;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goPrev, goNext, goHome]);

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

      const canvas = await window.html2canvas(iframe.contentDocument.body, {
        width: 390,
        height: 844,
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
  }, [currentScreen, activeState, metadata, show, activeOutputDir, activeProject]);

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

  // Empty state
  if (orderedScreens.length === 0) {
    return (
      <div className="main-content" style={{ padding: "40px", textAlign: "center" }}>
        <ProjectSelector
          projects={projects}
          activeIndex={activeIndex}
          onSelect={setActive}
          onAddProject={addProject}
          onAddFolder={addFolderToWorkspace}
          onRemoveProject={removeProject}
          onRemoveFolder={removeFolder}
        />
        <p style={{ color: "var(--brand-muted)", marginTop: 24 }}>
          No screens found. Check the project directory.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh" }}>
      {capturing ? (
        <CaptureProgress
          screens={orderedScreens}
          metadata={metadata!}
          getScreenUrl={getScreenUrl}
          saveCapture={saveCapture}
          onDone={handleCaptureAllDone}
        />
      ) : (
        <>
          {/* Project selector — fixed top-center */}
          <div className="project-selector-bar">
            <ProjectSelector
              projects={projects}
              activeIndex={activeIndex}
              onSelect={setActive}
              onAddProject={addProject}
              onAddFolder={addFolderToWorkspace}
              onRemoveProject={removeProject}
              onRemoveFolder={removeFolder}
            />
          </div>
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
                />
              )}
            </div>
          </div>
          <LeftDrawer
            open={leftDrawerOpen}
            onToggle={() => setLeftDrawerOpen((p) => !p)}
            metadata={metadata}
          />
          <RightDrawer
            open={rightDrawerOpen}
            onToggle={() => setRightDrawerOpen((p) => !p)}
            screens={orderedScreens}
            activeScreen={currentScreen}
            metadata={metadata}
            onSelect={navigate}
            projectName={projectLabel}
          />
          {!isSummary && (
            <BottomBar
              name={screenName(currentScreen)}
              index={currentIndex}
              total={total}
              activeTool={dockTool}
              projectName={projectLabel}
              onToolChange={handleDockTool}
              onPrev={goPrev}
              onNext={goNext}
              onCapture={handleCapture}
              onSummary={() => {
                goNext();
                setDockTool("");
              }}
              onHelp={() => setHelpOpen(true)}
            />
          )}
          <HelpModal show={helpOpen} onClose={() => setHelpOpen(false)} />
          <Toast message={toast.message} visible={toast.visible} ok={toast.ok} />
        </>
      )}
    </div>
  );
}
