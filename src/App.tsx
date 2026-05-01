import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useScreens, computeOrderedScreens } from "./hooks/useScreens";
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
import { RightDrawer } from "./components/RightDrawer";
import { HelpModal } from "./components/HelpModal";
import { Toast } from "./components/Toast";
import { screenName, DEVICE_PRESETS, DEVICE_CYCLE } from "./constants";
import type { DeviceMode } from "./constants";
import type { CaptureResult, MarkerRect, MarkerContext, Metadata } from "./types";
import { extractMarkedContext } from "./acp/extractMarkerContext";
import type { FileSource } from "./hooks/useFileSystem";
import {
  createFileSource,
  preloadOpfsCache,
  loadHandle,
  resolveHandle,
  readMetadata,
  listHtmlFiles,
  readFile,
  dataUrlToBlob,
} from "./hooks/useFileSystem";


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
    addFoldersToWorkspace,
    removeProject,
    removeFolder,
    setActive,
    renameProject,
    renameFolder,
  } = useProjects();

  const { toast, show } = useToast();

  // ── File System Access API state ──
  const [inputHandle, setInputHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [outputHandle, setOutputHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [fsMetadata, setFsMetadata] = useState<Metadata | null | undefined>(undefined);
  const [handlesLoading, setHandlesLoading] = useState(false);
  const blobUrlCacheRef = useRef<Record<string, string>>({});
  const [fsLoading, setFsLoading] = useState(false);

  // ── Per-folder screen cache (key: "wsIdx-folderIdx") ──
  const [perFolderScreens, setPerFolderScreens] = useState<Record<string, string[]>>({});

  // Digest changes only when folder configuration changes (not on activeFolder toggle)
  const foldersDigest = useMemo(() => {
    return JSON.stringify(
      projects.map((p) =>
        p.type === "workspace"
          ? p.folders.map(
              (f) =>
                `${f.inputHandleId ?? ""}::${f.handlePath?.join("/") ?? ""}::${f.inputDir ?? ""}`,
            )
          : [],
      ),
    );
  }, [projects]);

  // Eagerly load per-folder screen lists when folder config changes
  useEffect(() => {
    let cancelled = false;
    const loadAll = async () => {
      const result: Record<string, string[]> = {};
      for (let wi = 0; wi < projects.length; wi++) {
        const p = projects[wi];
        if (p.type !== "workspace") continue;
        for (let fi = 0; fi < p.folders.length; fi++) {
          if (cancelled) return;
          const key = `${wi}-${fi}`;
          const folder = p.folders[fi];
          try {
            let meta: Metadata | null = null;
            if (folder.inputHandleId) {
              const root = await loadHandle(folder.inputHandleId);
              const handle =
                root && folder.handlePath && folder.handlePath.length > 0
                  ? await resolveHandle(root, folder.handlePath).catch(() => null)
                  : root;
              if (handle) {
                meta = await readMetadata(handle) as Metadata | null;
              }
            } else if (folder.inputDir) {
              const resp = await fetch(`/api/metadata?dir=${encodeURIComponent(folder.inputDir)}`);
              meta = await resp.json();
            }
            result[key] = computeOrderedScreens(meta);
          } catch {
            result[key] = [];
          }
        }
      }
      if (!cancelled) setPerFolderScreens(result);
    };
    loadAll();
    return () => { cancelled = true; };
  }, [foldersDigest]);

  // Load FS handles when active folder changes
  useEffect(() => {
    setInputHandle(null);
    setOutputHandle(null);
    setFsMetadata(undefined);
    setFsLoading(false);
    blobUrlCacheRef.current = {};

    if (!activeFolder?.inputHandleId && !activeFolder?.outputHandleId) return;

    let cancelled = false;

    (async () => {
      setHandlesLoading(true);
      try {
        const handlePath = activeFolder?.handlePath;
        const bothSame =
          activeFolder?.inputHandleId &&
          activeFolder?.outputHandleId &&
          activeFolder.inputHandleId === activeFolder.outputHandleId;

        if (bothSame) {
          const root = await loadHandle(activeFolder!.inputHandleId!);
          if (cancelled) return;
          const h =
            root && handlePath && handlePath.length > 0
              ? await resolveHandle(root, handlePath).catch(() => null)
              : root;
          setInputHandle(h);
          setOutputHandle(h);
        } else {
          if (activeFolder?.inputHandleId) {
            const root = await loadHandle(activeFolder.inputHandleId);
            if (cancelled) return;
            const h =
              root && handlePath && handlePath.length > 0
                ? await resolveHandle(root, handlePath).catch(() => null)
                : root;
            setInputHandle(h);
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
  }, [activeFolder?.inputHandleId, activeFolder?.outputHandleId, activeFolder?.handlePath?.join('/')]);

  // Load metadata and pre-cache blob URLs from FS handle
  useEffect(() => {
    if (!inputHandle) {
      for (const url of Object.values(blobUrlCacheRef.current)) {
        URL.revokeObjectURL(url);
      }
      blobUrlCacheRef.current = {};
      setFsMetadata(undefined);
      setFsLoading(false);
      return;
    }

    let cancelled = false;
    const prevUrls = Object.values(blobUrlCacheRef.current);
    blobUrlCacheRef.current = {};

    (async () => {
      setFsMetadata(undefined);
      setFsLoading(true);

      try {
        const meta = await readMetadata(inputHandle);
        if (cancelled) return;

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
          // Blob pre-caching failure is non-fatal
        }

        if (!cancelled) {
          for (const url of prevUrls) {
            URL.revokeObjectURL(url);
          }
          blobUrlCacheRef.current = cache;
          setFsMetadata(meta as Metadata | null);
        }
      } catch {
        if (!cancelled) {
          setFsMetadata(null);
        }
      } finally {
        if (!cancelled) setFsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [inputHandle]);

  const getScreenUrl = useCallback(
    (screen: string, state?: string): string => {
      if (activeFolder?.inputHandleId) {
        const key = state ? `${screen}_${state}` : screen;
        return blobUrlCacheRef.current[key] || blobUrlCacheRef.current[screen] || '';
      }
      if (state) {
        return `/screens/${screen}_${state}.html?dir=${encodeURIComponent(activeInputDir)}`;
      }
      return `/screens/${screen}.html?dir=${encodeURIComponent(activeInputDir)}`;
    },
    [activeInputDir, activeFolder?.inputHandleId],
  );

  const fileSource = useMemo<FileSource | null>(() => {
    return createFileSource({
      inputHandle: inputHandle ?? undefined,
      outputHandle: outputHandle ?? undefined,
    });
  }, [inputHandle, outputHandle]);

  useEffect(() => {
    if (!fileSource || !activeFolder?.name) return;
    const folderKey = `folder_${activeFolder.name}`;
    preloadOpfsCache(fileSource, folderKey).catch(() => {});
  }, [fileSource, activeFolder?.name]);

  const saveCapture = useCallback(
    async (filename: string, dataUrl: string): Promise<CaptureResult> => {
      if (!fileSource || !fileSource.writable) {
        return { filename, ok: true };
      }
      try {
        const content = dataUrlToBlob(dataUrl);
        await fileSource.writeFile(filename, content);
        return { filename, ok: true };
      } catch (err) {
        return { filename, ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
    [fileSource],
  );

  const preloadedMetadata = fsMetadata !== undefined ? fsMetadata : undefined;
  const screensDir = activeFolder?.inputHandleId ? "" : activeInputDir;

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
  } = useScreens(screensDir, preloadedMetadata);

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

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setActiveState("default");
  }, [currentScreen]);

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

  useEffect(() => {
    setMarkerRect(null);
    setMarkerContext(null);
  }, [currentScreen]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

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

      const link = document.createElement("a");
      link.download = filename;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

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

  const handleCaptureAll = useCallback(() => {
    setCapturing(true);
  }, []);

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

  const handleDockTool = useCallback(
    (tool: string) => {
      if (tool === dockTool) {
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

  const handleStateChange = useCallback((_screen: string, state: string) => {
    setActiveState(state);
  }, []);

  const handleMark = useCallback(
    (payload: { rect: MarkerRect; screen: string; state: string }) => {
      setMarkerRect(payload.rect);
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

  const handleResetMarker = useCallback(() => {
    setMarkerRect(null);
    setMarkerContext(null);
  }, []);

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

  const handleAddWorkspace = useCallback((name: string) => {
    addProject({
      type: "workspace",
      name: name.trim(),
      folders: [],
      activeFolder: 0,
    });
  }, [addProject]);

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

  const handleRenameWorkspace = useCallback((index: number, name: string) => {
    renameProject(index, name);
  }, [renameProject]);

  const handleRenameFolder = useCallback((projectIdx: number, folderIdx: number, name: string) => {
    renameFolder(projectIdx, folderIdx, name);
  }, [renameFolder]);

  return (
    <div data-caid="app" style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden" }}>
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
            perFolderScreens={perFolderScreens}
            activeScreen={currentScreen}
            onSelect={navigate}
            onSetActive={setActive}
            onAddWorkspace={handleAddWorkspace}
            onAddFolder={handleAddFolder}
            onRemoveProject={removeProject}
            onRemoveFolder={removeFolder}
            onAddFolders={addFoldersToWorkspace}
            onRenameWorkspace={handleRenameWorkspace}
            onRenameFolder={handleRenameFolder}
            fileSourceType={fileSource?.type ?? null}
            fileSourceLabel={fileSource?.label ?? ''}
          />
          <div className="content-area" ref={contentAreaRef}>
            <div className="main-content">
              {orderedScreens.length === 0 ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, flexDirection: "column", gap: 12 }}>
                  {handlesLoading || fsLoading ? (
                    <p style={{ color: "var(--brand-muted)", fontSize: 14 }}>
                      Loading screens...
                    </p>
                  ) : activeFolder?.inputHandleId && fsMetadata === undefined ? (
                    <p style={{ color: "var(--brand-muted)", fontSize: 14 }}>
                      Loading screens from file system...
                    </p>
                  ) : (
                    <p style={{ color: "var(--brand-muted)", fontSize: 14 }}>
                      No screens found. Press \ to open workspace drawer and add a project.
                    </p>
                  )}
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
                  scale={scale}
                  logicalW={logicalW}
                  logicalH={logicalH}
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
          {!isSummary && total > 0 && (
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
