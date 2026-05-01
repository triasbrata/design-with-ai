# MK-SCR001: Folder Auto-Discovery -- Technical Specification

**Status:** DRAFT  
**Feature Code:** MK-SCR001  
**Author:** Tech Lead  
**Date:** 2026-05-01

---

## 1. Overview

Folder Auto-Discovery replaces the manual path-input and server-side scan workflows with a single native directory picker flow. Users pick a parent folder via `showDirectoryPicker()`, the system recursively scans for `screen-metadata.json` files client-side (max depth 6), and a modal shows all discovered golden spec folders for selection. Selected folders are added to the workspace with IndexedDB-backed file handles.

**Key architectural decision:** New folders are FS API only. Existing path-based workspaces (saved in localStorage) continue to work through backward-compatible middleware endpoints. Dead scan infrastructure is removed.

---

## 2. Data Flow

```
LeftDrawer "+" button
  -> Pick Folder (showDirectoryPicker)
  -> saveHandle(id, rootHandle) to IndexedDB
  -> scanForGoldenDirectories(rootHandle) -> ScanResult
  -> ScanResultsModal (client-side, no server fetch)
  -> User selects subset
  -> LeftDrawer maps GoldenDirResult[] -> CaptureFolder[] (with inputHandleId + handlePath)
  -> addFoldersToWorkspace(workspaceIdx, newFolders)
  -> setActive(workspaceIdx, firstNewFolderIdx)
```

### handlePath Resolution Across Sessions

```
App startup with activeFolder.inputHandleId + activeFolder.handlePath:
  loadHandle(activeFolder.inputHandleId) -> rootHandle
  if (handlePath.length > 0):
    resolveHandle(rootHandle, handlePath) -> goldenDirHandle
  else:
    rootHandle itself is the golden dir handle
  createFsApiSource(goldenDirHandle) -> FileSource
```

This mechanism already exists in App.tsx (lines 71-126) and needs no changes. The new flow ensures `handlePath` is correctly serialized from `GoldenDirResult.relativePath` when adding folders.

---

## 3. Domain Type Changes

### 3.1 No change -- CaptureFolder (types.ts)

```typescript
interface CaptureFolder {
  name: string;
  inputDir: string;       // "" for FS API mode
  outputDir: string;      // "" for FS API mode
  inputHandleId?: string; // IndexedDB key
  outputHandleId?: string;
  handlePath?: string[];  // relative path from root handle to golden dir
}
```

### 3.2 Enhancement -- GoldenDirResult (useFileSystem.ts)

Add `htmlFileCount` field to support the "0 HTML files -> hide" rule without a second directory walk.

```typescript
export interface GoldenDirResult {
  name: string;
  relativePath: string[];
  handle: FileSystemDirectoryHandle;
  screenCount: number;
  htmlFileCount: number;  // NEW
}
```

### 3.3 New -- ScanResult (useFileSystem.ts)

```typescript
export interface ScanResult {
  folders: GoldenDirResult[];
  malformedCount: number;        // metadata JSON parse failures
  permissionDeniedCount: number; // subdirectories that couldn't be read
}
```

### 3.4 Removals -- types.ts

- Remove `ClientProject` interface
- Remove `ClientFileEntry` interface

---

## 4. Component Changes

### 4.1 LeftDrawer.tsx (Major rewrite of "Add Folder" section)

**State removals:**
- `folderForm` (simplified: only needs `workspaceIdx`)
- `scanResults: ScannedFolder[]`
- `scanningWsIdx`
- `folderFileInputRef` (hidden input ref)
- `existingPaths` memo (replaced by per-workspace context)

**Callback removals:**
- `handleBrowseFolder` (webkitdirectory)
- `handleSubmitFolder` (path-based submit + `/api/scan-folder` fetch)
- `handleBulkAddFolders` (old server-based modal callback)

**New state:**

```typescript
const [pickState, setPickState] = useState<{
  workspaceIdx: number;
  scanning: boolean;
  results: GoldenDirResult[] | null;
  rootHandleId: string;
  rootHandle: FileSystemDirectoryHandle;
  skippedMalformed: number;
  skippedPermission: number;
  emptyHtmlCount: number;
  error: string | null;
} | null>(null);
```

**New callback -- `handlePickAndScan`:**

```typescript
const handlePickAndScan = useCallback(async (workspaceIdx: number) => {
  const dir = await pickDirectory();
  if (!dir) return;

  setPickState({ workspaceIdx, scanning: true, results: null,
    rootHandleId: '', rootHandle: dir.handle, skippedMalformed: 0,
    skippedPermission: 0, emptyHtmlCount: 0, error: null });

  try {
    const handleId = generateHandleId();
    await saveHandle(handleId, dir.handle);

    const scanResult = await scanForGoldenDirectories(dir.handle);
    // Post-filter: remove folders with 0 HTML files
    const valid: GoldenDirResult[] = [];
    let emptyHtml = 0;
    for (const f of scanResult.folders) {
      if (f.htmlFileCount > 0) valid.push(f);
      else emptyHtml++;
    }

    setPickState({ workspaceIdx, scanning: false, results: valid,
      rootHandleId: handleId, rootHandle: dir.handle,
      skippedMalformed: scanResult.malformedCount,
      skippedPermission: scanResult.permissionDeniedCount,
      emptyHtmlCount: emptyHtml, error: null });
  } catch (err) {
    setPickState({ ...pickState!, scanning: false,
      error: err instanceof Error ? err.message : 'Scan failed' });
  }
}, [pickDirectory, saveHandle, generateHandleId]);
```

**New callback -- `handleAddFoldersFromScan`:**

```typescript
const handleAddFoldersFromScan = useCallback(
  (selected: GoldenDirResult[]) => {
    if (!pickState) return;
    const wsIdx = pickState.workspaceIdx;
    const handleId = pickState.rootHandleId;
    const existingCount = projects[wsIdx]?.type === 'workspace'
      ? (projects[wsIdx] as Workspace).folders.length 
      : 0;

    const newFolders: CaptureFolder[] = selected.map(r => ({
      name: r.name,
      inputDir: "",
      outputDir: "",
      inputHandleId: handleId,
      outputHandleId: handleId,
      handlePath: r.relativePath,
    }));

    onAddFolders?.(wsIdx, newFolders);
    onSetActive?.(wsIdx, existingCount); // auto-activate first new folder
    setPickState(null);
  },
  [pickState, projects, onAddFolders, onSetActive],
);
```

**UI change -- simplified "Add Folder" form:**

Replace the multi-field form (name, inputDir, outputDir, Browse...) with a single "Pick Folder" button. When `pickState.scanning === true`, show a loading indicator. When `pickState.results` is set, the `ScanResultsModal` opens.

### 4.2 BulkAddFoldersModal -> ScanResultsModal.tsx (Renamed, extensively modified)

**New props:**

```typescript
interface ScanResultsModalProps {
  open: boolean;
  scanning: boolean;
  onClose: () => void;
  onAddFolders: (folders: GoldenDirResult[]) => void;
  folders: GoldenDirResult[];
  existingHandlePaths: Set<string>;
  skippedMalformed: number;
  skippedPermission: number;
  emptyHtmlCount: number;
  error: string | null;
}
```

**Behavior changes:**

1. **Dedup**: Compare `result.relativePath.join('/')` against `existingHandlePaths` set. Folders matching an existing path get `disabled` checkbox + `grayout` + tooltip "Already in workspace".

2. **Relative path display**: Show `relativePath.join(' / ')` as subtitle.

3. **Select All / Deselect All**: Two buttons above the list. Select All skips existing (disabled) items.

4. **Warning lines**: When `skippedMalformed > 0`, show "Skipped N folders with invalid metadata." When `skippedPermission > 0`, show "Skipped N folders (permission denied)."

5. **Empty state**: When `!scanning && folders.length === 0 && !error`, show "No golden spec folders found in the selected directory."

6. **Error state**: When `error` is set, show the error message.

7. **Scanning state**: When `scanning === true`, show spinner + "Scanning folders..."

### 4.3 ScanFoldersModal.tsx -- DELETE

Entire file (~155 lines) removed. Replaced by `ScanResultsModal`.

### 4.4 useFileSystem.ts -- Enhance + Clean

**Enhance `scanForGoldenDirectories`:** Change return type to `ScanResult`, add `htmlFileCount`, track `malformedCount` and `permissionDeniedCount`.

**Remove `createViteMiddlewareSource()`** (~50 lines).

**Remove `createUploadSource()`** (~30 lines).

**Simplify `createFileSource()`:** Remove `uploadFiles`, `uploadMetadata`, `projectType` parameters. Only accept FS handles + backward-compat path-based dirs.

**Remove from exports:** `dataUrlToBlob`, `blobToDataUrl`, `SOURCE_LABELS`, `SOURCE_ICONS`, `FileSourceType` values `'vite-middleware'` and `'upload'`.

### 4.5 App.tsx -- Simplify

- Remove `projectFileMap` and all `activeProject?.type === "client"` branches
- Simplify `getScreenUrl` (remove client project branch)
- Simplify `createFileSource` call (remove upload/client params)
- Remove unused state (`fsPermissionError`, `fsRetryCount`)
- Keep handle-loading useEffect (cross-session resolution)

### 4.6 ProjectSelector.tsx

Remove: "Browse Folder" button, ClientProject rendering, `handleBrowse` callback, hidden file input, all client project state.

### 4.7 vite.config.ts

Remove `/api/scan-folders` and `/api/scan-folder` middleware endpoints.
Keep `/api/metadata`, `/api/capture`, `/screens/` for backward compat.

### 4.8 index.css

Remove unused CSS classes: `.ld-source-badge.vite-middleware`, `.ld-source-badge.upload`.

---

## 5. Removals Summary

| Item | File | Lines | Reason |
|------|------|-------|--------|
| `ScanFoldersModal` | `src/components/ScanFoldersModal.tsx` | ~155 | Replaced by client-side ScanResultsModal |
| `BulkAddFoldersModal` (rename) | `src/components/BulkAddFoldersModal.tsx` | ~125 | Replaced by ScanResultsModal |
| `createViteMiddlewareSource` | `src/hooks/useFileSystem.ts` | ~50 | No longer created for new folders |
| `createUploadSource` | `src/hooks/useFileSystem.ts` | ~30 | Upload mode removed |
| Upload params in `createFileSource` | `src/hooks/useFileSystem.ts` | ~15 | No more client projects |
| `ClientProject`, `ClientFileEntry` | `src/types.ts` | ~10 | No more client projects |
| Path inputs in LeftDrawer form | `src/components/LeftDrawer.tsx` | ~60 | Only Pick Folder button |
| `handleBrowseFolder` | `src/components/LeftDrawer.tsx` | ~25 | webkitdirectory removed |
| Hidden file input | `src/components/LeftDrawer.tsx` | ~10 | webkitdirectory removed |
| `/api/scan-folders` | `vite.config.ts` | ~45 | Replaced by client-side scan |
| `/api/scan-folder` | `vite.config.ts` | ~60 | Replaced by client-side scan |
| `Browse Folder` button | `src/components/ProjectSelector.tsx` | ~15 | Upload removed |
| Client project render | `src/components/ProjectSelector.tsx` | ~35 | Client projects removed |
| `.vite-middleware` CSS class | `src/index.css` | ~5 | No longer used |
| `.upload` CSS class | `src/index.css` | ~5 | No longer used |

---

## 6. Backward Compatibility

Existing path-based workspaces (saved in localStorage with `inputDir`/`outputDir`) continue to work via retained middleware endpoints. When `activeFolder.inputHandleId` is undefined, `getScreenUrl` falls through to the middleware path. These workspaces can still be used but new folders must use FS API.

---

## 7. Implementation Phases

### Phase 1: Core Scan Flow
1. Enhance `scanForGoldenDirectories()` — add `htmlFileCount`, `ScanResult` return type
2. Create `ScanResultsModal.tsx` (from `BulkAddFoldersModal.tsx`)
3. Refactor `LeftDrawer.tsx` — simplify form, wire pick->scan->modal flow
4. Wire `handleAddFoldersFromScan` with `inputHandleId` + `handlePath`

### Phase 2: Clean Up Dead Code
1. Delete `ScanFoldersModal.tsx`
2. Delete `BulkAddFoldersModal.tsx`
3. Remove `createUploadSource()` and `createViteMiddlewareSource()`
4. Simplify `createFileSource()` factory
5. Remove upload/client project types
6. Remove scan endpoints from `vite.config.ts`
7. Simplify `ProjectSelector.tsx`

### Phase 3: Polish & Test
1. Remove unused CSS classes
2. Verify backward compat with existing path-based workspaces
3. Test empty states, error states, dedup, auto-activation

---

## 8. Critical Files for Implementation

- `src/hooks/useFileSystem.ts` — Enhance `scanForGoldenDirectories`, add `ScanResult`, remove dead source factories
- `src/components/LeftDrawer.tsx` — Major refactor of "Add Folder" section
- `src/components/BulkAddFoldersModal.tsx` — Rework into `ScanResultsModal.tsx`
- `src/App.tsx` — Simplify file source creation, remove client project code
- `vite.config.ts` — Remove `/api/scan-folders` and `/api/scan-folder` endpoints
- `src/types.ts` — Remove `ClientProject`, `ClientFileEntry`
- `src/components/ProjectSelector.tsx` — Remove upload/client project UI
