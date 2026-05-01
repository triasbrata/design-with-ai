# MK-SCR001: Folder Auto-Discovery — UX Specification

**Status:** UX_REVIEW  
**Feature Code:** MK-SCR001  
**Date:** 2026-05-01  
**Author:** UX Designer

---

## 1. Overview

Replace the current manual folder-add form (folder name + input/output directory text fields) with a one-button flow that leverages the **File System Access API**. User picks a parent directory (e.g. `docs/`), the system recursively scans for `screen-metadata.json` in subdirectories, and a modal displays all discovered golden spec folders for batch selection.

---

## 2. Interaction Flow

```
[LeftDrawer] → [Simplified Add Folder Form] → [Native Directory Picker] → [Scan Results Modal] → [Workspace Update]
```

### Step-by-Step

| # | Action | System Response |
|---|--------|----------------|
| 1 | User clicks `+` on a workspace header | Inline folder-add form appears below workspace header |
| 2 | User clicks **"Pick Folder"** button (the ONLY element in the form) | Browser native `showDirectoryPicker()` dialog opens |
| 3 | User cancels picker | Dialog closes. No state change. Form stays open. |
| 4 | User selects a folder | **Scan Results Modal** opens immediately with loading state |
| 5 | System scans recursively (max depth 6) | Loading spinner + "Scanning folders..." in modal |
| 6 | Modal shows results | See §4 — State Matrix for all variants |
| 7 | User selects/deselects folders | Checkbox state updates live. "Add Selected (N)" counter updates. |
| 8 | User clicks **"Add Selected (N)"** | Selected folders saved. Modal closes. Toast: "Added N folder(s)." |
| 9 | Post-add | First added folder auto-selects in workspace. Folder form closes. |
| 10 | User clicks **Cancel** or **X** | Modal closes. Folder form returns to idle. Workspace unchanged. |

---

## 3. Component Architecture

### 3.1 Simplified "Add Folder" Form (LeftDrawer modification)

**File:** `LeftDrawer.tsx` — Section below workspace header (existing `ld-folder-create` div)

**Before (current):**
```
┌─────────────────────────────────────────┐
│ [Folder name input           ]          │
│ [Pick Folder]                           │
│ Using native file system access         │
│ ┌─────────────────────────────────────┐ │
│ │  ✕                    ✓ (disabled) │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**After (simplified):**
```
┌─────────────────────────────────────────┐
│ [Pick Folder]                           │
└─────────────────────────────────────────┘
```

**Changes:**
| Element | Action |
|---------|--------|
| Folder name `<input>` | **REMOVED** |
| Output directory `<input>` | **REMOVED** |
| Input directory `<input>` | **REMOVED** |
| "Browse..." `<button>` (webkitdirectory) | **REMOVED** |
| "FS API supported" helper text | **REMOVED** |
| Check / X action buttons | **REMOVED** |
| "Pick Folder" button | **KEPT** — becomes the ONLY element |
| Scanning indicator (`ld-scanning`) | **KEPT** — shown inline while scanning |

**The "Pick Folder" button:**
- Styled identically to existing `ld-folder-browse` class (10px font, 600 weight, 4px 8px padding)
- No changes to button visual style
- Single `onClick` → `handlePickFolder()` → opens `showDirectoryPicker()` → on success, triggers scan

**Behavior after pick:**
- Form div transitions from idle state to scanning state
- "Pick Folder" text replaced by spinner + "Scanning folders..."
- Modal opens when scan completes (results or empty)
- When modal closes (Cancel): form returns to idle, "Pick Folder" visible again
- When modal adds folders: form hids (as folders now exist in workspace)

### 3.2 Scan Results Modal (NativeScanModal)

**File:** New component `NativeScanModal.tsx` (or heavily modified `BulkAddFoldersModal.tsx`)

This replaces `ScanFoldersModal` entirely and supersedes `BulkAddFoldersModal` for the FS API path. The `BulkAddFoldersModal` (server-side scan for path-based mode) is kept for backward compatibility during transition, but the new modal is the primary entry point.

#### 3.2.1 Data Model

```typescript
interface ScanResultItem {
  name: string;              // Directory name (e.g. "golden")
  relativePath: string[];    // Path segments from picked root (e.g. ["anav-v3", "design"])
  screenCount: number;       // Total screens from metadata
  isDuplicate: boolean;      // Already in workspace (compare by handlePath + inputHandleId)
  handle: FileSystemDirectoryHandle;  // Reference (not persisted in state)
}
```

#### 3.2.2 Props

```typescript
interface NativeScanModalProps {
  open: boolean;
  onClose: () => void;                          // Cancel / X close
  onAddFolders: (folders: ScanFolderPayload[]) => void;  // Confirm add
  folders: ScanResultItem[];                    // Scan results
  loading: boolean;                             // Scanning in progress
  scannedParentName: string;                    // e.g. "docs" — shown in subtitle
  warning?: { skippedCount: number; reason: string } | null;  // e.g. "3 folders with invalid metadata"
  error?: string | null;                        // Fatal scan error
}
```

---

## 4. State Matrix

### 4.1 Simplified Add Folder Form (in LeftDrawer)

| State | Visual | Trigger |
|-------|--------|---------|
| **IDLE** | `[Pick Folder]` button | Default state when no scan in progress |
| **SCANNING** | `<Loader2 className="ld-spinner" />` + "Scanning folders..." | Fires immediately after successful `showDirectoryPicker()` |
| **FS_API_UNAVAILABLE** | Showing alternate message | Browser doesn't support File System Access API (user notified in previous patterns) |

### 4.2 Scan Results Modal

| State | Visual | Conditions |
|-------|--------|------------|
| **LOADING** | Centered spinner + "Scanning folders..." | `loading=true`, `folders=[]` |
| **EMPTY** | Search icon + "No golden spec folders found in the selected directory." | `loading=false`, `folders.length=0`, no error |
| **ERROR** | Red background banner + error message + "Try Again" button | `error` is non-null |
| **WARNING** | Yellow/amber banner above list: "Skipped N folders with invalid metadata." | `warning` is non-null, `folders.length>0` |
| **RESULTS** | Select All / Deselect All buttons + scrollable list of folder items + action buttons | `loading=false`, `folders.length>0` |
| **NO_SELECTION** | Same as RESULTS but "Add Selected (N)" shows `(0)` and is disabled | `selected.size === 0` |

---

## 5. Visual Layout

### 5.1 Scan Results Modal Layout

```
┌─────────────────────────────────────────────┐
│  [icon] Golden Spec Folders          [X]    │  ← sf-header
│─────────────────────────────────────────────│
│  Found in: "docs"                           │  ← parent folder subtitle (12px, muted)
│─────────────────────────────────────────────│
│  [Select All]  [Deselect All]               │  ← sf-select-actions
│─────────────────────────────────────────────│
│  ⚠ Skipped 2 folders with invalid metadata. │  ← warning banner (if applicable)
│─────────────────────────────────────────────│
│  ┌─────────────────────────────────────────┐│
│  │ ☑  golden                               ││  ← sf-item (selected)
│  │    anav-v3/design         12 screens    ││
│  ├─────────────────────────────────────────┤│
│  │ ☑  golden                               ││  ← sf-item (selected)
│  │    moneykitty/settings     8 screens    ││
│  ├─────────────────────────────────────────┤│
│  │ ☐  golden                     (gray)    ││  ← sf-item.existing
│  │    checkout/design           5 screens  ││     (opacity 0.45, tooltip)
│  └─────────────────────────────────────────┘│
│─────────────────────────────────────────────│
│          [Cancel]  [Add Selected (3)]       │  ← sf-actions
└─────────────────────────────────────────────┘
```

### 5.2 Row Layout (per folder item)

```
┌───────────────────────────────────────────────┐
│ [☑] │  golden                         12 scr │
│      │  anav-v3/design                      │
└───────────────────────────────────────────────┘
  ↑        ↑           ↑            ↑
  checkbox  name        relative     screen
  (16px)   (13px,      path         count
           bold)       (10px,       badge
                       muted,       (10px,
                       ellipsis)    chip bg)
```

### 5.3 Duplicate Row Visual Treatment

```
┌───────────────────────────────────────────────┐
│ [☐] (disabled) │  golden (opacity 0.45)  5 sc│
│                  │  checkout/design           │
└───────────────────────────────────────────────┘
  ↑                     ↑
  cursor: not-allowed   tooltip on hover:
                        "Already in workspace"
```

**CSS tokens used:**
- `opacity: 0.45` on the entire row (existing `.sf-item.existing`)
- `.sf-checkbox`: `cursor: not-allowed` (existing)
- `pointer-events: none` on the row (existing)
- `title="Already in workspace"` on the `<label>` (existing)
- No hover highlight effect (blocked by `pointer-events: none`)

### 5.4 Loading State Layout

```
┌─────────────────────────────────────────────┐
│  Golden Spec Folders                        │
├─────────────────────────────────────────────┤
│                                             │
│         ↻  Scanning folders...              │  ← centered
│                                             │
├─────────────────────────────────────────────┤
│                                             │
└─────────────────────────────────────────────┘
```

Spinner (`Loader2`) rotates via `@keyframes sf-spin`. Text in `var(--brand-muted)`. Padding 32px top/bottom (existing `sf-loading` class).

### 5.5 Empty State Layout

```
┌─────────────────────────────────────────────┐
│  Golden Spec Folders                 [X]    │
├─────────────────────────────────────────────┤
│                                             │
│         🔍                                 │  ← search icon (32px, muted)
│   No golden spec folders found in           │
│   the selected directory.                   │  ← text (13px, muted)
│                                             │
│          [Try Again]  [Cancel]              │
└─────────────────────────────────────────────┘
```

"Try Again" button re-opens `showDirectoryPicker()` with the same workspace context.

### 5.6 Error State Layout

```
┌─────────────────────────────────────────────┐
│  Golden Spec Folders                 [X]    │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │ ✗ Failed to scan directory.        │    │  ← sf-error (brand-accent-light bg)
│  │ Permission denied for subfolder     │    │
│  │ "node_modules/.cache".             │    │
│  └─────────────────────────────────────┘    │
│                                             │
│          [Try Again]  [Cancel]              │
└─────────────────────────────────────────────┘
```

### 5.7 Warning + Results Layout

When some folders were skipped but valid results exist, a compact warning banner sits above the list:

```
┌─────────────────────────────────────────────┐
│  ⚠  Skipped 2 folders with invalid metadata.│  ← compact warning (11px, amber)
│─────────────────────────────────────────────┤
│  [Select All]  [Deselect All]               │
│  ┌─ folder items ──────────────────────────┐│
│  │ ...                                      ││
│  └──────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

---

## 6. States Detail

### 6.1 Loading State (during scan)

- Modal backdrop + modal container rendered immediately after `showDirectoryPicker()` resolves
- Inner content: centered `sf-loading` div with `Loader2` icon + "Scanning folders..."
- No action buttons visible (Cancel hidden during scan? No — Cancel should still be available)
- **Decision:** Show Cancel button in footer during loading, so user can abort and return to the drawer

### 6.2 Empty State (zero results)

- Icon: 🔍 (Search icon from existing icon set, 32px, `var(--brand-muted)`)
- Message: "No golden spec folders found in the selected directory."
- Two buttons: "Try Again" (re-opens picker) and "Cancel" (close modal)
- No "Add Selected" button (disabled since no results)

### 6.3 Error State (scan failed)

- Error banner (`sf-error`): full-width, red/amber background, error message
- Two buttons: "Try Again" and "Cancel"
- Example errors: permission denied on root, IndexedDB failure, catastrophic scan error

### 6.4 Warning + Results (mixed state)

- Warning banner above the list (not replacing it)
- Warning text: "Skipped N folders with invalid metadata." — clickable to expand? No, keep it simple — single line
- List of valid results below the warning
- All normal list interactions work (select/deselect, add)

### 6.5 Results State (normal)

- Full list of discovered folders
- Each row shows: checkbox, folder name, relative path, screen count
- Duplicates grayed out with tooltip
- Select All / Deselect All (affects only non-duplicate items)
- "Add Selected (N)" enabled only when `selected.size > 0`

---

## 7. Duplicate Detection

### 7.1 Match Logic

A discovered folder is a **duplicate** if there exists a `CaptureFolder` in the current workspace with the same:
- `inputHandleId` (same root handle) AND
- `handlePath` (same path segments from root)

Since `handlePath` is a `string[]`, comparison is by `JSON.stringify()` of the path array.

### 7.2 Existing Matching in LeftDrawer

The current `existingPaths` is a `Set<string>` of `inputDir` values. For FS API mode, `inputDir` is `""`, so this set is useless. A new method of dedup is needed:

```typescript
// In LeftDrawer or new NativeScanModal
const existingHandlePaths = useMemo(() => {
  const paths = new Set<string>();
  projects.forEach((p) => {
    if (p.type === "workspace") {
      p.folders.forEach((f) => {
        if (f.handlePath && f.inputHandleId) {
          paths.add(`${f.inputHandleId}::${JSON.stringify(f.handlePath)}`);
        }
      });
    }
  });
  return paths;
}, [projects]);
```

Then during scan result rendering:
```typescript
const isDuplicate = existingHandlePaths.has(
  `${rootHandleId}::${JSON.stringify(result.relativePath)}`
);
```

---

## 8. Post-Success Behavior

After user clicks **"Add Selected (N)"**:

| Behavior | Detail |
|----------|--------|
| Modal closes | Animated fade out |
| Toast appears | "Added N folder(s) to [workspace name]" using existing `show()` function |
| Workspace updates | New folders appear in workspace tree |
| Auto-select | The **first** newly added folder becomes the active folder (navigates to its screens) |
| Folder form | Closes (returns to `+` button state) since folders exist |
| Scanning indicator | Hidden |
| IndexedDB | Each selected folder's handle is saved with `saveHandle(generateHandleId(), handle)` before `onAddFolders` is called |

### Save Sequence

```
for each selected folder:
  handleId = generateHandleId()
  await saveHandle(handleId, folder.handle)
  add to payload: { name, inputHandleId: handleId, outputHandleId: handleId, handlePath: relativePath }

onAddFolders(workspaceIdx, payload)
→ addFoldersToWorkspace mutates workspace
→ first folder auto-selected via setActive(workspaceIdx, newFolderIndex)
```

---

## 9. Edge Cases

| Case | UX Behavior |
|------|-------------|
| User cancels `showDirectoryPicker()` | No state change. Form stays idle. |
| Browser doesn't support FS API | Show alternate path: either keep old form (transition) or disable button with tooltip "File System Access API not supported in this browser" |
| Zero `screen-metadata.json` found | Empty state modal with "Try Again" + "Cancel" |
| Some folders have malformed JSON | Warning banner: "Skipped N folders with invalid metadata." Valid folders still listed. |
| Folder has metadata but 0 HTML entries | **Excluded from results entirely** (PRD spec). No row rendered. |
| Permission denied on subfolder | Private subfolder skipped silently. Warning banner? **Decision:** silent skip (too noisy to warn per-folder). |
| Permission denied on root | Error state modal with message. "Try Again" button. |
| Nested golden specs | Both displayed as separate rows. Each has its own `handlePath` (e.g. `["design", "golden"]` vs `["design", "golden", "sub"]`). |
| IndexedDB `saveHandle` fails on one folder | Show error toast: "Failed to save folder X. Please try again." Other folders still added. Partial success. |
| All folders are duplicates | Modal shows all rows grayed out. "Add Selected" disabled. Message suggestion: remove empty state — just show "All folders are already in your workspace." with Cancel only. |
| Scan depth > 6 hits | Already handled by `scanForGoldenDirectories` constant. Nothing to show in UX. |
| User clicks "Pick Folder" while scan is running | Button hidden during scanning state. Guard against double-pick. |

### 9.1 All-Duplicates Edge Case

When ALL discovered folders already exist in workspace:

```
┌─────────────────────────────────────────────┐
│  Golden Spec Folders                 [X]    │
├─────────────────────────────────────────────┤
│  All folders are already in your workspace. │  ← info message (muted, centered)
│                                             │
│          [Close]                            │
└─────────────────────────────────────────────┘
```

No "Add Selected" button. Single "Close" button (same as Cancel).

---

## 10. CSS Tokens & Styles

All styles reuse existing design tokens from `src/index.css`. No new color tokens needed.

| Token | Usage |
|-------|-------|
| `var(--brand-surface)` | Modal background |
| `var(--brand-text)` | Folder name, modal title |
| `var(--brand-muted)` | Screen count badge text, loading/empty text |
| `var(--brand-muted-light)` | Relative path subtitle |
| `var(--brand-chip)` | Screen count badge background, hover bg |
| `var(--brand-accent)` | "Add Selected" button, checkbox accent |
| `var(--brand-accent-hover)` | "Add Selected" hover |
| `var(--brand-accent-light)` | Selected row background, warning banner bg |
| `var(--brand-border)` | Select All/Deselect All button border |
| `var(--brand-shadow-heavy)` | Modal box shadow |
| `var(--brand-warning)` | Warning banner text |
| `opacity: 0.45` | Duplicate row (existing `.sf-item.existing`) |

**New CSS needed (only for warning banner):**

```css
.sf-warning {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  margin-bottom: 8px;
  font-size: 11px;
  color: var(--brand-warning);
  background: color-mix(in srgb, var(--brand-warning) 10%, transparent);
  border-radius: 6px;
}
```

---

## 11. Component Reuse & Diff

| Existing Component | Fate |
|-------------------|------|
| `ScanFoldersModal.tsx` | **REMOVED** (replaced by NativeScanModal) |
| `BulkAddFoldersModal.tsx` | **KEPT** (still used for path-based scan from old flow, deprecated) |
| `NativeScanModal.tsx` | **NEW** — main modal for FS API scan flow |
| `LeftDrawer.tsx` | **MODIFIED** — simplified form, new scan + modal trigger |
| `App.tsx` | **MODIFIED** — new `handleAddFoldersBulk` that accepts `handleId` + `handlePath` |
| `useFileSystem.ts` | **NO CHANGE** — `scanForGoldenDirectories()` already exists |

---

## 12. Keyboard & Accessibility

| Action | Keyboard |
|--------|----------|
| Open Pick Folder | Tab to button → Enter/Space |
| Scan results modal | Focus trap inside modal |
| Toggle checkbox | Space when focused on checkbox label |
| Select All | Tab to button → Enter |
| Deselect All | Tab → Enter |
| Add Selected | Tab → Enter (disabled when `selected.size === 0`) |
| Cancel | Escape key (existing) |
| Close (X) | Tab → Enter/Space |

- Checkbox `<label>` wraps entire row for large click target (existing pattern)
- `title` attribute on duplicate rows for tooltip
- `aria-label` on close button
- `disabled` attribute on "Add Selected" when count is zero
