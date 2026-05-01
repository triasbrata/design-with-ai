# MK-SCR001: Folder Auto-Discovery

**Status:** PM_APPROVED
**Feature Code:** MK-SCR001
**Date:** 2026-05-01

## Ringkasan

User pick folder parent (e.g. `docs/`) via native File System Access API. System rekursif scan semua subdirektori mencari `screen-metadata.json`, tampilkan hasil di modal seleksi. User pilih folder mana yang ditambahkan ke workspace. Folder yang sudah ada (by absolute path) di-grayout dengan tooltip.

## Happy Flow

1. User buka LeftDrawer → klik "+" pada workspace → muncul form "Add Folder"
2. Form hanya punya satu tombol: **"Pick Folder"** (native `showDirectoryPicker()`)
3. User pilih folder parent (e.g. `docs/`)
4. System rekursif scan semua subdirektori (max depth 6) mencari `screen-metadata.json`
5. Muncul modal berisi daftar folder yang ditemukan:
   - Nama folder (dari directory name, e.g. `golden`)
   - Subtitle relative path dari folder yang di-pick (e.g. `anav-v3/design`)
   - Jumlah screens
   - Checkbox untuk select/deselect
6. Folder yang SUDAH ada di workspace (match by absolute path) → **grayout + disabled checkbox + tooltip** "Already in workspace"
7. User pilih folder yang ingin ditambahkan → klik "Add Selected (N)"
8. Folder ditambahkan ke workspace dengan `inputHandleId` + `handlePath` (relative path segments)
9. System langsung load folder pertama yang ditambahkan

## Scope

**FS API ONLY.** Mode lain (vite-middleware path-based, upload/webkitdirectory) di-drop. Tidak ada manual path input.

## Negative Cases

| Case | Behaviour |
|------|-----------|
| Zero `screen-metadata.json` ditemukan | Empty state: "No golden spec folders found in the selected directory." |
| `screen-metadata.json` malformed (JSON parse error) | Skip folder tersebut. Tampilkan warning di modal: "Skipped N folders with invalid metadata." |
| Folder punya metadata tapi 0 HTML files | **Hide** dari hasil scan (tidak ditampilkan) |
| Nested golden specs (`docs/a/design/golden/` DAN `docs/a/design/golden/sub/`) | **Tampilkan keduanya** |
| Permission denied di subfolder tertentu | Skip subfolder tersebut. Lanjutkan scan. Notifikasi: "Skipped N folders (permission denied)." |
| Folder sudah ada di workspace (duplicate path) | Grayout + disabled + tooltip "Already in workspace" |
| User cancel `showDirectoryPicker()` | Tidak terjadi apa-apa, form tetap terbuka |
| IndexedDB gagal simpan handle | Tampilkan error, user bisa retry |

## Technical Constraints

- Hanya browser yang support File System Access API (`showDirectoryPicker`)
- Handle disimpan di IndexedDB via `saveHandle()` (sudah ada)
- `handlePath` (relative path segments dari root handle ke golden dir) disimpan untuk rekonstruksi handle antar session
- `scanForGoldenDirectories()` sudah ada di `useFileSystem.ts` — perlu dipanggil dari flow baru
- Scan depth max: 6 level (existing constant)
- Folder yang ditemukan tidak perlu input/output dir path — hanya butuh `inputHandleId` + `outputHandleId` + `handlePath`

## Data Model (existing, no change)

```typescript
interface CaptureFolder {
  name: string;
  inputDir: string;       // "" untuk FS API mode
  outputDir: string;      // "" untuk FS API mode
  inputHandleId?: string; // IndexedDB key
  outputHandleId?: string;
  handlePath?: string[];  // relative path dari root handle ke golden dir
}
```

## UI Changes

### Form "Add Folder" (simplified)
- **HAPUS:** input path manual (inputDir, outputDir)
- **HAPUS:** tombol "Browse..." (webkitdirectory fallback)
- **HAPUS:** form input folder name (auto-filled dari scan result)
- **KEEP:** tombol "Pick Folder" (native FS API)
- **NEW:** setelah pick → langsung scan → tampilkan modal

### Modal Hasil Scan (NEW / modifikasi BulkAddFoldersModal)
- Tampilkan daftar folder yang ditemukan
- Setiap item: checkbox + folder name + subtitle relative path + screen count
- Folder existing: grayout + disabled + tooltip
- Tombol "Select All" / "Deselect All"
- Tombol "Add Selected (N)" + "Cancel"

## Removals

- ✂️ `createViteMiddlewareSource()` — tidak digunakan lagi
- ✂️ `createUploadSource()` — tidak digunakan lagi
- ✂️ Input path manual di LeftDrawer folder form
- ✂️ `handleBrowseFolder` (webkitdirectory fallback)
- ✂️ `/api/scan-folders` endpoint usage (client-side scan via FS API gantikan)
- ✂️ `ScanFoldersModal` (digantikan modal baru / BulkAddFoldersModal yg dimodifikasi)

## Acceptance Criteria

1. User bisa pick folder parent → system auto-scan recursive
2. Hasil scan tampil di modal dengan informasi lengkap (nama, path relatif, screen count)
3. Folder duplikat di-grayout dengan tooltip
4. User bisa select/deselect folder sebelum add
5. Folder yang dipilih ditambahkan ke workspace sebagai CaptureFolder dengan handleId + handlePath
6. Zero results tampilkan empty state
7. Malformed metadata di-skip dengan warning
8. Workspace tetap berfungsi normal setelah penambahan
