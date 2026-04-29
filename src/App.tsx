import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useScreens } from "./hooks/useScreens";
import { useDeviceScale } from "./hooks/useDeviceScale";
import { useProjects } from "./hooks/useProjects";
import { useToast } from "./hooks/useToast";
import { useAcpBridge } from "./acp/useAcpBridge";
import { DrawerTabs } from "./acp/DrawerTabs";
import { Viewer } from "./components/Viewer";
import { Summary } from "./components/Summary";
import { CaptureProgress } from "./components/CaptureProgress";
import { BottomBar } from "./components/BottomBar";
import { LeftDrawer } from "./components/LeftDrawer";
import { ChatDrawer } from "./components/ChatDrawer";
import { HelpModal } from "./components/HelpModal";
import { Toast } from "./components/Toast";
import { screenName, DEVICE_PRESETS, DEVICE_CYCLE } from "./constants";
import type { DeviceMode } from "./constants";
import type { CaptureResult, ClientProject, MarkerRect, MarkerContext, Metadata } from "./types";
import { extractMarkedContext } from "./acp/extractMarkerContext";
import { loadHandle, readMetadata, listHtmlFiles, readFile, writeFile, dataUrlToBlob } from "./hooks/useFileSystem";


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

  // ── File System Access API state ──
  const [inputHandle, setInputHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [outputHandle, setOutputHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [fsMetadata, setFsMetadata] = useState<Metadata | null | undefined>(undefined);
  const [handlesLoading, setHandlesLoading] = useState(false);
  const blobUrlCacheRef = useRef<Record<string, string>>({});

  // Load FS handles when active folder changes
  useEffect(() => {
    setInputHandle(null);
    setOutputHandle(null);
    setFsMetadata(undefined);
    blobUrlCacheRef.current = {};

    if (!activeFolder?.inputHandleId && !activeFolder?.outputHandleId) return;

    let cancelled = false;

    (async () => {
      setHandlesLoading(true);
      try {
        const bothSame =
          activeFolder?.inputHandleId &&
          activeFolder?.outputHandleId &&
          activeFolder.inputHandleId === activeFolder.outputHandleId;

        if (bothSame) {
          const h = await loadHandle(activeFolder!.inputHandleId!);
          if (!cancelled) {
            setInputHandle(h);
            setOutputHandle(h);
          }
        } else {
          if (activeFolder?.inputHandleId) {
            const h = await loadHandle(activeFolder.inputHandleId);
            if (!cancelled) setInputHandle(h);
          }
          if (activeFolder?.outputHandleId) {
            const h = await loadHandle(activeFolder.outputHandleId);
            if (!cancelled) setOutputHandle(h);
          }
        }
      } catch {
        if (!cancelled) {
          setInputHandle(null);
          setOutputHandle(null);
        }
      }
      if (!cancelled) setHandlesLoading(false);
    })();

    return () => { cancelled = true; };
  }, [activeFolder?.inputHandleId, activeFolder?.outputHandleId]);

  // Load metadata and pre-cache blob URLs from FS handle
  useEffect(() => {
    if (!inputHandle) {
      // Revoke and clear blob URL cache
      for (const url of Object.values(blobUrlCacheRef.current)) {
        URL.revokeObjectURL(url);
      }
      blobUrlCacheRef.current = {};
      setFsMetadata(undefined);
      return;
    }

    let cancelled = false;
    const prevUrls = Object.values(blobUrlCacheRef.current);
    blobUrlCacheRef.current = {};

    (async () => {
      setFsMetadata(undefined);

      // Load metadata
      const meta = await readMetadata(inputHandle);
      if (cancelled) return;

      // Pre-cache blob URLs for all HTML files
      const cache: Record<string, string> = {};
      try {
        const files = await listHtmlFiles(inputHandle);
        for (const file of files) {
          if (cancelled) break;
          const content = await readFile(inputHandle, file);
          const key = file.replace(/\.html$/, '');
          cache[key] = URL.createObjectURL(new Blob([content], { type: 'text/html' }));
        }
      } catch {
        // Blob pre-caching failure is non-fatal; metadata is still usable
      }

      if (!cancelled) {
        // Revoke old URLs
        for (const url of prevUrls) {
          URL.revokeObjectURL(url);
        }
        blobUrlCacheRef.current = cache;
        setFsMetadata(meta as Metadata | null);
      }
    })();

    return () => { cancelled = true; };
  }, [inputHandle]);

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

  // Resolve screen URLs:
  //   FS handle mode   → blob URL cache (from indexedDB handles)
  //   Workspace        → Vite middleware (/screens/...?dir=...)
  //   Client project   → pre-loaded blob URLs from webkitdirectory picker
  const getScreenUrl = useCallback(
    (screen: string, state?: string): string => {
      // FS handle mode: use blob URL cache
      if (activeFolder?.inputHandleId) {
        const key = state ? `${screen}_${state}` : screen;
        return blobUrlCacheRef.current[key] || blobUrlCacheRef.current[screen] || '';
      }

      // Workspace mode: Vite middleware
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
    [activeProject, activeInputDir, projectFileMap, activeFolder?.inputHandleId],
  );

  // Save capture: FS handle → direct write, workspace → POST, client → no-op
  const saveCapture = useCallback(
    async (filename: string, dataUrl: string): Promise<CaptureResult> => {
      // FS handle mode: write directly to the file system
      if (outputHandle) {
        try {
          const blob = dataUrlToBlob(dataUrl);
          await writeFile(outputHandle, filename, blob);
          return { filename, ok: true };
        } catch (err) {
          return { filename, ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      }

      if (activeProject?.type === "client") {
        return { filename, ok: true };
      }

      // Fallback: POST to Vite middleware
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
    [outputHandle, activeProject, activeOutputDir],
  );

  // Pre-loaded metadata: FS handle mode, then client project mode
  // When fsMetadata is undefined (no FS handle or still loading), fall through
  // When fsMetadata is null (no metadata file found), pass null to useScreens
  const preloadedMetadata =
    fsMetadata !== undefined
      ? fsMetadata
      : activeProject?.type === "client"
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
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
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

  const contentAreaRef = useRef<HTMLDivElement>(null);
  const { scale, logicalW, logicalH } = useDeviceScale(contentAreaRef, deviceMode);

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

      // Device mode shortcuts: Meta/Ctrl + 1-6
      if ((e.metaKey || e.ctrlKey) && /^[1-6]$/.test(e.key)) {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        if (idx < DEVICE_CYCLE.length) setDeviceMode(DEVICE_CYCLE[idx]);
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

      // Trigger download via anchor click (works for all modes)
      const link = document.createElement("a");
      link.download = filename;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Save via unified path (FS handle, middleware POST, or no-op for client)
      const result = await saveCapture(filename, dataUrl);
      if (result.ok) {
        show(`Saved: ${filename}`, true);
      } else {
        show(`Save failed: ${result.error}`, false);
      }
    } catch {
      show("Capture failed", false);
    }
  }, [currentScreen, activeState, metadata, show, deviceMode, saveCapture]);

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
      folders: [],
      activeFolder: 0,
    });
  }, [addProject]);

  // Add folder to workspace (from plus button or context menu)
  const handleAddFolder = useCallback(
    (workspaceIdx: number, name: string, inputDir: string, outputDir: string, inputHandleId?: string, outputHandleId?: string) => {
      addFolderToWorkspace(workspaceIdx, {
        name,
        inputDir,
        outputDir: outputDir || inputDir,
        ...(inputHandleId ? { inputHandleId } : {}),
        ...(outputHandleId ? { outputHandleId } : {}),
      });
    },
    [addFolderToWorkspace],
  );

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
            onRemoveFolder={removeFolder}
          />
          <div className="content-area" ref={contentAreaRef}>
            <div className="main-content">
              {orderedScreens.length === 0 ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
                  <p style={{ color: "var(--brand-muted)", fontSize: 14 }}>
                    No screens found. Press \ to open workspace drawer and add a project.
                  </p>
                </div>
              ) : isSummary ? (
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
          <ChatDrawer
            open={chatDrawerOpen}
            onToggle={() => setChatDrawerOpen((p) => !p)}
            pinned={rightPinned}
            onPinToggle={() => setRightPinned((p) => !p)}
          >
            <DrawerTabs
              connected={acpState.connected}
              currentScreen={currentScreen}
              markerContext={markerContext}
              onResetMarker={handleResetMarker}
            />
          </ChatDrawer>
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
