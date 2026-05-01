# MK-SCR001: Folder Auto-Discovery UAT Checklist

**Feature:** MK-SCR001 — Folder Auto-Discovery
**QA Date:** 2026-05-01
**Status:** DRAFT
**Tester:** [Name]
**Browser/OS:** [Browser + Version, OS]

---

## 1. Happy Flow

| ID | Scenario | Expected Result | Status |
|----|----------|-----------------|--------|
| UAT-001 | **Open "Add Folder" form in workspace** — Open LeftDrawer, click "+" button on any workspace. | A folder-add form appears with a "Pick Folder" button and a folder name input. No manual `inputDir`/`outputDir` path fields visible when FS API is supported. | TODO |
| UAT-002 | **Click "Pick Folder"** — Click "Pick Folder" button. | Native `showDirectoryPicker()` dialog opens (OS-native folder picker). | TODO |
| UAT-003 | **Pick a directory with golden specs** — Select a folder that contains subdirectories with `screen-metadata.json` files (e.g., `docs/` with `anav-v3/design/golden/` inside). | System recursively scans all subdirectories up to max depth 6 looking for `screen-metadata.json`. A scan-results modal appears after scanning completes. | TODO |
| UAT-004 | **Scan results modal displays folder info** — After scan completes, observe the modal. | Each discovered golden spec folder shows: (a) folder name, (b) relative path from the picked root, (c) screen count (from metadata `meta.totalScreens`), (d) a checkbox. | TODO |
| UAT-005 | **Select individual folder** — Check an unchecked folder and uncheck a checked folder. | Checkbox toggles selection. "Add Selected (N)" counter updates accordingly. | TODO |
| UAT-006 | **Select All / Deselect All** — Click "Select All" then "Deselect All". (If implemented) | All folders become selected, then all become deselected. Counter shows "Add Selected (0)" after deselect. | TODO |
| UAT-007 | **Add selected folders to workspace** — Select some folders and click "Add Selected (N)". | Modal closes. Selected folders appear in the workspace tree under the correct workspace. | TODO |
| UAT-008 | **First folder auto-loads** — After adding folders via the modal. | The first folder among the added ones becomes the active folder, and its screens load in the main viewer. | TODO |
| UAT-009 | **CaptureFolder structure is correct (FS API mode)** — Inspect a newly added folder's data. | Each new CaptureFolder has: `name`, `inputDir: ""`, `outputDir: ""`, `inputHandleId` (valid IndexedDB key), `handlePath` (array of relative path segments from root to golden dir). | TODO |
| UAT-010 | **Workspace functions normally after add** — Navigate between screens, capture, delete, etc. in the newly added folders. | All workspace operations (select screen, capture, zoom, markers) work identically to manually added folders. | TODO |
| UAT-011 | **Scan root folder also has metadata** — Pick a folder that itself contains `screen-metadata.json` (root is itself a golden spec dir). | Root folder appears in the scan results list with `relativePath: []`. | TODO |

## 2. Negative Cases

| ID | Scenario | Expected Result | Status |
|----|----------|-----------------|--------|
| UAT-020 | **Zero golden spec folders found** — Pick a directory with no `screen-metadata.json` anywhere in its subtree. | Modal shows empty state: "No golden spec folders found in the selected directory." No folders are added. | TODO |
| UAT-021 | **Malformed `screen-metadata.json`** — A subdirectory contains `screen-metadata.json` with invalid JSON (syntax error). | That folder is skipped from scan results. Modal shows a warning: "Skipped N folders with invalid metadata." (N = count of malformed metadata files found). | TODO |
| UAT-022 | **Folder has metadata but zero HTML files** — A golden spec folder with valid `screen-metadata.json` but no `.html` files inside. | Folder is **hidden** from scan results entirely (not shown in modal). | TODO |
| UAT-023 | **Duplicate folder (already in workspace)** — Pick a directory whose subtree includes a golden spec that is already in the current workspace (matched by absolute path). | That folder row shows: grayed out, checkbox disabled, tooltip "Already in workspace". Cannot be re-selected. | TODO |
| UAT-024 | **Permission denied on subfolder** — The picked root has a subdirectory the browser cannot read (e.g., system-protected folder). | Scan skips that subfolder gracefully. Modal shows notification: "Skipped N folders (permission denied)." Scan continues for other directories. | TODO |
| UAT-025 | **User cancels directory picker** — Click "Pick Folder", then press Escape or click Cancel in the native dialog. | `showDirectoryPicker()` returns (AbortError caught). No action taken. Form remains open and unchanged. | TODO |
| UAT-026 | **IndexedDB save fails** — Simulate IndexedDB failure (e.g., private browsing mode in some browsers, or quota exceeded) when saving the directory handle. | Error is displayed to the user (inline or toast). User can retry the "Pick Folder" action. Workspace state is not corrupted. | TODO |
| UAT-027 | **Click "Cancel" in scan results modal** — Open the modal, click Cancel/Skip. | Modal closes. No folders are added. Workspace state is unchanged. | TODO |

## 3. Edge Cases

| ID | Scenario | Expected Result | Status |
|----|----------|-----------------|--------|
| UAT-030 | **Deep nesting (depth > 6)** — Folder tree has `screen-metadata.json` at depth 7 or deeper. | Those deeply nested golden specs are NOT discovered (max scan depth = 6). They do not appear in scan results. | TODO |
| UAT-031 | **Hidden directories (starting with `.`)** — A `.hidden/` directory contains `screen-metadata.json`. | The hidden directory is skipped entirely. Not scanned, not shown. | TODO |
| UAT-032 | **`node_modules` directories** — A `node_modules/` subtree contains `screen-metadata.json`. | The `node_modules` directory is skipped entirely. Not scanned, not shown. | TODO |
| UAT-033 | **Nested golden specs** — Both `docs/a/design/golden/` and `docs/a/design/golden/sub/` contain `screen-metadata.json`. | **Both** appear in scan results as separate entries with different relative paths. | TODO |
| UAT-034 | **Folder name collision (different paths, same name)** — Two folders at different paths share the same directory name (e.g., `path/a/golden` and `path/b/golden`). | Both appear in scan results. The list differentiates them by relative path subtitle. Both can be selected independently. | TODO |
| UAT-035 | **Pick root that is itself a golden spec with nested golden specs** — Root folder has `screen-metadata.json` AND subdirectories with `screen-metadata.json`. | Root folder appears in results (with `relativePath: []`) AND all nested golden specs appear separately. | TODO |
| UAT-036 | **Very large directory tree (>1000 subdirectories)** — Pick a folder with thousands of subdirectories. | Scan completes within reasonable time (< 30 seconds). UI shows a loading indicator during scan. No browser freeze. | TODO |
| UAT-037 | **Pick root, add folders, then pick another root** — Perform two consecutive folder picks under the same workspace. | Second pick opens a fresh scan modal. Results from first scan and second pick are independent. Folders from both picks coexist in the workspace. | TODO |
| UAT-038 | **Reopen app after reload — handles persist** — Add folders via auto-discovery, reload the page. | In IndexedDB-scanned mode: folder handles are reconstructed via `resolveHandle(rootHandle, handlePath)`. Folders still function (screens load, captures work). | TODO |
| UAT-039 | **Handle path with special characters** — A golden spec folder name contains spaces, Unicode, or special characters (e.g., `my golden specs (v2)/`). | Folder name and relative path display correctly. `resolveHandle()` successfully resolves the path. | TODO |
| UAT-040 | **Single folder result** — Pick a root that contains exactly one golden spec subdirectory. | Modal shows exactly one folder. It is auto-selected. "Add Selected (1)" works as expected. | TODO |
| UAT-041 | **Empty workspace (no folders yet), add via auto-discovery** — Start with a workspace that has zero folders, then use Pick Folder + scan. | Folders added correctly. First folder auto-activates. | TODO |
| UAT-042 | **Pick a file instead of a directory** — If browser allows, attempt to select an individual file via `showDirectoryPicker`. | `showDirectoryPicker()` should only allow directory selection. If somehow a file is picked, behavior is undefined but should not crash. | TODO |
| UAT-043 | **Screen count edge: metadata missing totalScreens** — `screen-metadata.json` exists but lacks `meta.totalScreens` (has `screens` object instead). | Screen count falls back to `Object.keys(meta.screens).length`. Folder is still shown. | TODO |
| UAT-044 | **Screen count edge: both totalScreens and screens are empty/zero** — `meta.totalScreens: 0` and `screens: {}`. | Currently this would show screenCount: 0. Per PRD, folder with 0 HTML files should be **hidden**. Need to verify implementation: does it check actual HTML files or just metadata? | TODO |
| UAT-045 | **Permission re-grant across sessions** — On page reload, browser may require permission re-grant for the stored handle. | If permission is denied on reload, the user sees a permission prompt or a clear error message. They can re-pick the directory. | TODO |

## 4. Implementation Gaps (Items Blocking Testing)

| ID | Gap Description | Impact | Status |
|----|-----------------|--------|--------|
| GAP-001 | `handlePickFolderNative()` in LeftDrawer picks and saves a handle but does NOT call `scanForGoldenDirectories()`. There is no wiring between picking a parent folder and launching the recursive scan. | Happy flow (UAT-003 through UAT-009) cannot be tested — the scan modal never appears after picking. | OPEN |
| GAP-002 | `BulkAddFoldersModal` uses `ScannedFolder` with `path: string` (old path-based model). It does not pass `inputHandleId` or `handlePath: string[]`. | Added folders will lack FS API handle info, falling back to path-based mode. UAT-009 fails. | OPEN |
| GAP-003 | `scanForGoldenDirectories()` does not filter out folders with 0 HTML files / 0 screens. PRD specifies they should be hidden. | UAT-022 cannot pass. | OPEN |
| GAP-004 | No loading indicator is shown during `scanForGoldenDirectories()` execution (the scan can take time for large trees). | UX gap — user sees no feedback between pick and modal appearance. | OPEN |
| GAP-005 | No existing unit tests for the auto-discovery flow (test directory has zero test files). | Test automation cannot be validated yet. | OPEN |

## 5. Browser Compatibility

| ID | Scenario | Expected Result | Status |
|----|----------|-----------------|--------|
| UAT-050 | **Google Chrome (v86+)** — Run all happy-path and negative-case tests. | Full support. `showDirectoryPicker()` available. IndexedDB handle storage works. All tests pass. | TODO |
| UAT-051 | **Microsoft Edge (v86+)** — Run all tests. | Full support (Chromium-based). Same behavior as Chrome. | TODO |
| UAT-052 | **Google Chrome for Android** — Run tests on Android Chrome. | FS API may not be supported on Android. App should detect unsupported browser and show fallback UI (webkitdirectory upload). | TODO |
| UAT-053 | **Mozilla Firefox** — Run tests. | File System Access API **not supported**. `isSupported()` returns `false`. App shows "Browse..." fallback instead of "Pick Folder". | TODO |
| UAT-054 | **Apple Safari (desktop + iOS)** — Run tests. | File System Access API **not supported** (Safari 16.4+ has partial support in Technology Preview only). `isSupported()` returns `false`. App shows fallback. | TODO |
| UAT-055 | **IndexedDB availability** — Run in a context where IndexedDB is available (all modern browsers). | Handle save/load operations succeed. | TODO |
| UAT-056 | **Private/Incognito mode** — Run in private browsing (Chrome Incognito, Edge InPrivate). | IndexedDB may have limited quota or be cleared on session end. Handle save should work during session. Reload may lose handles (graceful degradation expected). | TODO |

## 6. Validation Plan

### 6.1 Manual Test Execution

1. **Prerequisites:**
   - A test directory tree with known golden spec folders at various depths
   - A malformed `screen-metadata.json` file
   - A golden spec folder with 0 HTML files
   - A directory tree exceeding depth 6
   - A folder already in the workspace (for duplicate testing)

2. **Test Data Setup** — Prepare a directory structure:
   ```
   test-root/
     anav-v3/
       design/
         golden/           # valid golden spec (5 screens)
           screen-metadata.json
           screenshot_1_spec.html
           ...
     component-library/
       golden/             # valid golden spec (3 screens)
         screen-metadata.json
         screenshot_a_spec.html
         ...
       golden/sub/         # nested golden spec (2 screens)
         screen-metadata.json
         ...
     .hidden/
       golden/             # SHOULD BE SKIPPED
         screen-metadata.json
     node_modules/
       golden/             # SHOULD BE SKIPPED
         screen-metadata.json
     broken-metadata/
       screen-metadata.json  # INVALID JSON
     empty-spec/           # valid metadata, 0 HTML files → HIDDEN
       screen-metadata.json  # meta.totalScreens: 0
   ```

3. **Execution Order:**
   - Group 1 (Happy Flow): UAT-001 through UAT-011
   - Group 2 (Negative): UAT-020 through UAT-027
   - Group 3 (Edge): UAT-030 through UAT-045
   - Group 4 (Browser): UAT-050 through UAT-056

### 6.2 Automated Test Recommendations

| Test Suite | Coverage | Priority |
|------------|----------|----------|
| `scanForGoldenDirectories` — unit test with mock handles | Verifies depth limit, hidden dir skip, node_modules skip, correct GoldenDirResult shape | P0 |
| `readMetadata` — unit test with malformed JSON | Returns null for invalid JSON, valid object for valid JSON | P0 |
| `scanForGoldenDirectories` — 0-screen filter | Folder with metadata but 0 screens is excluded from results | P1 |
| `scanForGoldenDirectories` — nested golden specs | Both parent and child golden spec dirs appear in results | P1 |
| `scanForGoldenDirectories` — permission denied | Failed subdirectory is skipped, scan continues | P1 |
| `BulkAddFoldersModal` — render + selection | Correct display of name/path/screenCount, checkbox toggle, grayout for existing | P1 |
| `saveHandle` / `loadHandle` / `resolveHandle` — round trip | Save root handle, load it, resolve sub-handle via handlePath | P1 |
| `LeftDrawer` — form state transitions | Pick folder → scan → modal → add → workspace updated | P2 |

### 6.3 Pass Criteria

- All UAT-001 through UAT-011 (Happy Flow) pass on at least one supported browser (Chrome/Edge).
- All negative case scenarios produce correct error/empty/disabled states.
- No unhandled exceptions during any scenario.
- GAP-001 through GAP-005 are resolved before full validation.

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-05-01 | QA (AI) | Initial version — mapped all PRD acceptance criteria to testable UAT scenarios, identified 5 implementation gaps, added browser compatibility matrix |
