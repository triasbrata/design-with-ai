# Screenshot Device HTML — Panduan Penggunaan

Tools untuk **design review viewer** + **golden baseline PNG capture**.
HTML spec file di `docs/moneykitty/design/golden/` ditampilkan di phone-frame 390×844px,
bisa di-toggle antara state (data/empty/loading/error), lalu di-screenshot otomatis.

## Arsitektur Viewer

```
src/
├── main.tsx / App.tsx        # Root: workspace mgmt, per-folder eager loading, keyboard shortcuts
├── types.ts                  # ScreenMeta, StateContext, Metadata, Project, CaptureFolder
├── constants.ts              # TIERS (screen ordering + tree grouping), DEVICE_PRESETS, screenName()
├── index.css                 # Brand tokens (CSS variables) + semua style per komponen
├── lib/cn.ts                 # Tailwind classname utility
├── hooks/
│   ├── useScreens.ts         # Fetch screen-metadata.json, computeOrderedScreens(), nav state
│   ├── useProjects.ts        # Workspace/folder CRUD persisted ke localStorage
│   ├── useFileSystem.ts      # File System Access API (IndexedDB + OPFS cache + FileSource)
│   ├── useDeviceScale.ts     # Scale factor for viewport
│   └── useToast.ts           # Toast notification state
├── components/
│   ├── LeftDrawer.tsx        # Workspace tree: per-folder tier-organized screen list + "Other"
│   ├── Viewer.tsx            # Toolbar + PhoneFrame + MetaPanel
│   ├── PhoneFrame.tsx        # Iframe wrapper (forwardRef, postMessage state switching)
│   ├── MetaPanel.tsx         # Description, purpose, key elements, states
│   ├── StateTabs.tsx         # State switching tab buttons
│   ├── Summary.tsx           # All-screens summary table (tier-organized)
│   ├── BottomBar.tsx         # Floating bottom toolbar: nav, tools, device picker, help
│   └── ...
```

### Data Flow

```
screen-metadata.json ──fetch──► useScreens ──computeOrderedScreens()──► orderedScreens[]
       │                              │                                        │
       │                      LeftDrawer (tree)                          Viewer (stage)
       │                      ┌─────────────────┐                       ┌──────────────┐
       │                      │ TIERS grouping   │                       │ PhoneFrame   │
       │                      │ + "Other" section│                       │ + MetaPanel  │
       │                      └─────────────────┘                       └──────────────┘
       │
       └── eager per-folder load (App.tsx useEffect) ──► perFolderScreens[workspaceIdx-folderIdx]
```

### Cara navigasi tree (LeftDrawer)

1. **TIERS grouping:** Screen dikelompokkan berdasarkan tier (T1-T4) dari `constants.ts`. Hanya screen yang terdaftar di TIERS yang muncul di bawah label tier.
2. **"Other" fallback:** Screen yang ada di `screen-metadata.json` tapi TIDAK terdaftar di TIERS manapun akan muncul di section **"Other"** di paling bawah.
3. Ini berlaku untuk **setiap folder** — jadi tiap folder punya tree-nya sendiri sesuai isi `screen-metadata.json` masing-masing.

## 1. Membuat Golden HTML Spec Baru

### 1.1 Buat file HTML di folder golden

File: `docs/moneykitty/design/golden/{nama_screen}_spec.html`

Template minimal:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=390, initial-scale=1.0, user-scalable=no">
<title>Screen Name — Golden Baseline</title>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root {
  --bg-page:       #FEF6E9;
  --bg-surface:    #FDFBF7;
  --accent-red:    #C45353;
  --text-primary:  #2B2B2B;
  --text-secondary:#8A8075;
  --border-hairline: #F2EBE0;
  --warm-bridge:   #F5EFE6;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body { margin: 0; font-family: 'Nunito', sans-serif; }

.phone-frame {
  width: 100%;
  min-height: 100vh;
  background: var(--bg-surface);
  display: flex;
  flex-direction: column;
}
</style>
</head>
<body>

<div class="phone-frame">

  <!-- State: Default (data) -->
  <div data-baseline-state="data">
    <!-- konten default screen disini -->
  </div>

  <!-- State: Empty -->
  <div data-baseline-state="empty" style="display:none">
    <!-- empty state disini -->
  </div>

  <!-- State: Loading -->
  <div data-baseline-state="loading" style="display:none">
    <!-- loading skeleton disini -->
  </div>

</div>

<!-- REQUIRED: state controller script -->
<script>
window.__baseline = {
  currentState: 'data',
  states: ['data', 'empty', 'loading'],
  setState: function(name) {
    document.querySelectorAll('[data-baseline-state]').forEach(el => {
      el.style.display = 'none';
    });
    const target = document.querySelector('[data-baseline-state="' + name + '"]');
    if (target) {
      target.style.display = '';
      this.currentState = name;
    }
  }
};

window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'setState' && e.data.state) {
    window.__baseline.setState(e.data.state);
  }
});
</script>
</body>
</html>
```

### 1.2 Aturan wajib (dari BASELINE_SPEC.md)

| Aturan | Keterangan |
|--------|-----------|
| `viewport` meta | `width=390, initial-scale=1.0, user-scalable=no` |
| Font | Nunito dari Google Fonts |
| Warna | HEX exact dari `lib/core/design/tokens.dart` |
| `.phone-frame` | Harus pakai `min-height: 100vh` |
| `window.__baseline` | Object dengan `setState()` function |
| `data-baseline-state` | Setiap state dibungkus div dengan atribut ini |
| `display:none` | Semua state non-default harus hidden |
| `postMessage` listener | Terima command dari parent viewer |
| `cai-id` attribute | Setiap komponen wajib punya `cai-id` (lihat section 1.3) |

### 1.3 Konvensi `cai-id` Attribute

Setiap elemen komponen dalam golden HTML spec **wajib** punya atribut `cai-id` (Context AI Identifier). Tujuannya: ketika context HTML dikasi ke AI, AI langsung tahu elemen yang mana tanpa perlu baca struktur DOM.

#### Format

```
{parent-scope}--{element-name}[--{variant}]
```

- **Separator:** double-dash `--`
- **Case:** kebab-case
- **Scope hierarki:** screen → container → element
- **Unik** dalam 1 file HTML

#### Contoh

```html
<!-- Screen-level containers -->
<div class="curved-sheet" cai-id="record--curved-sheet">...</div>
<div class="top-pills" cai-id="record--top-pills">...</div>

<!-- Interactive elements -->
<button class="fab" cai-id="record--fab">+</button>
<div class="toggle" cai-id="settings--toggle-dark-theme">...</div>

<!-- Content components -->
<div class="card card-yellow" cai-id="assets--account-card-cash">...</div>
<div class="filter-chips" cai-id="assets--filter-chips">...</div>
<div class="section-title" cai-id="bills--section-title-expenses">...</div>

<!-- State-specific containers -->
<div data-baseline-state="empty" cai-id="record--empty-state">...</div>
<div data-baseline-state="loading" cai-id="record--loading-skeleton">...</div>

<!-- List items -->
<li class="settings-item" cai-id="settings--item-membership">...</li>
<li class="settings-item" cai-id="settings--item-dark-theme">...</li>

<!-- Nav elements -->
<div class="nav-capsule" cai-id="nav--capsule">...</div>
<div class="nav-tab active" cai-id="nav--tab-bills">...</div>
```

#### Aturan

| Aturan | Keterangan |
|--------|-----------|
| Scope prefix | Gunakan nama screen sebagai prefix: `record--`, `bills--`, `assets--`, `settings--` |
| Shared components | Komponen yang muncul di banyak screen pakai prefix screen tempat dia muncul |
| State divs | State container juga wajib `cai-id` |
| Naming | Deskriptif — baca nama langsung paham elemen apa. Contoh: `record--quick-action-grid`, bukan `record--grid-1` |
| Unik per file | Tidak boleh ada 2 elemen dengan `cai-id` sama dalam 1 file |

#### Daftar cai-id per screen (reference)

**Record Screen:**
| Element | cai-id |
|---------|-------|
| TopPillsRow | `record--top-pills` |
| Pill kiri "All ledgers" | `record--pill-all-ledgers` |
| Pill kanan "+ New" | `record--pill-add-new` |
| CurvedSheet | `record--curved-sheet` |
| QuickActionGrid | `record--quick-action-grid` |
| SectionTitle "Expenses" | `record--section-title-expenses` |
| SummaryCard | `record--summary-card` |
| TransactionList | `record--transaction-list` |
| EmptyState | `record--empty-state` |
| Loading skeleton | `record--loading-skeleton` |
| Error state | `record--error-state` |
| FAB | `record--fab` |

**Bills Screen:**
| Element | cai-id |
|---------|-------|
| TopPillsRow | `bills--top-pills` |
| Pill kiri | `bills--pill-all-ledgers` |
| Pill kanan calendar | `bills--pill-calendar` |
| CurvedSheet | `bills--curved-sheet` |
| Metrics header | `bills--metrics-header` |
| Expenses amount | `bills--expenses-amount` |
| Income amount | `bills--income-amount` |
| SearchBar | `bills--search-bar` |
| SectionTitle "Expenses" | `bills--section-title-expenses` |
| Donut chart expenses | `bills--donut-expenses` |
| Legend expenses | `bills--legend-expenses` |
| SectionTitle "Income" | `bills--section-title-income` |
| Donut chart income | `bills--donut-income` |
| Legend income | `bills--legend-income` |
| EmptyState | `bills--empty-state` |
| Loading skeleton | `bills--loading-skeleton` |
| Error state | `bills--error-state` |
| Search empty | `bills--search-empty` |
| FAB | `bills--fab` |

**Assets Screen:**
| Element | cai-id |
|---------|-------|
| TopPillsRow | `assets--top-pills` |
| Pill kiri | `assets--pill-all-ledgers` |
| Pill kanan filter | `assets--pill-filter` |
| CurvedSheet | `assets--curved-sheet` |
| Subheader | `assets--subheader` |
| FilterChips | `assets--filter-chips` |
| DotGridTimeline | `assets--dot-grid-timeline` |
| AccountCard Cash | `assets--account-card-cash` |
| AccountCard Bank | `assets--account-card-bank` |
| AccountCard Deposit | `assets--account-card-deposit` |
| SectionTitle "Assets" | `assets--section-title-assets` |
| Donut chart | `assets--donut-chart` |
| Legend | `assets--legend` |
| EmptyState | `assets--empty-state` |
| Loading skeleton | `assets--loading-skeleton` |
| Error state | `assets--error-state` |
| FAB | `assets--fab` |

**Settings Screen:**
| Element | cai-id |
|---------|-------|
| TopPillsRow | `settings--top-pills` |
| Pill kiri | `settings--pill-all-ledgers` |
| Pill kanan search | `settings--pill-search` |
| CurvedSheet | `settings--curved-sheet` |
| Title "Custom" | `settings--title` |
| Item Membership | `settings--item-membership` |
| Item Dark theme | `settings--item-dark-theme` |
| Toggle dark theme | `settings--toggle-dark-theme` |
| Item Language | `settings--item-language` |
| Item Currency | `settings--item-currency` |
| Item Comma separator | `settings--item-comma-separator` |
| Toggle comma | `settings--toggle-comma` |
| Item Fingerprint | `settings--item-fingerprint` |
| Item Category mgmt | `settings--item-category-management` |
| Loading skeleton | `settings--loading-skeleton` |

**FloatingBottomNav:**
| Element | cai-id |
|---------|-------|
| Nav capsule | `nav--capsule` |
| Tab Record | `nav--tab-record` |
| Tab Bills | `nav--tab-bills` |
| Tab Assets | `nav--tab-assets` |
| Tab Settings | `nav--tab-settings` |

## 2. Daftarkan Screen ke screen-metadata.json

File: `docs/moneykitty/design/golden/screen-metadata.json`

Tambah entry baru di `screens`:

```json
"nama_screen_spec": {
  "name": "Nama Screen",
  "tier": "T1",
  "description": "Deskripsi singkat screen ini.",
  "purpose": "Tujuan screen ini dalam user flow.",
  "keyElements": ["Element 1", "Element 2", "Element 3"],
  "states": ["data", "empty", "loading"],
  "interactions": ["tap A -> navigate B", "tap C -> open sheet"],
  "stateContext": {
    "data": {
      "label": "With Data",
      "description": "Apa yang user lihat di state ini.",
      "goal": "Apa yang harus bisa user lakukan."
    },
    "empty": {
      "label": "Empty",
      "description": "Tampilan saat tidak ada data.",
      "goal": "CTA path untuk user."
    },
    "loading": {
      "label": "Loading",
      "description": "Tampilan skeleton loading.",
      "goal": "User tahu data sedang dimuat."
    }
  }
}
```

**Tier mapping:**
| Tier | Kategori |
|------|----------|
| T1 | Main User Flows (Record, Transaction List, Add, Wizard, Bills, Report, Assets) |
| T2 | Management (Category, Pocket, Ledger managers) |
| T3 | Settings & Security (Settings, Theme, Security, PIN) |
| T4 | Navigation & Shell (FloatingBottomNav, User) |

## 3. Daftarkan Screen ke `src/constants.ts` (viewer tree)

Edit `tools/screenshot_device_html/src/constants.ts` — tambahkan nama file ke objek `TIERS`:

```ts
export const TIERS: Record<string, TierInfo> = {
  T1: {
    label: 'Main User Flows',
    screens: [
      'record_screen_spec',
      'transaction_list_screen_spec',
      'nama_screen_spec',  // <-- tambahkan disini
      // ...
    ],
  },
  // ...
};
```

> **WAJIB:** Setiap screen baru yang dibuat HARUS didaftarkan ke `TIERS` di `src/constants.ts` — BUKAN di `index.html`.
>
> Screen yang TIDAK didaftarkan di TIERS tetap bisa dirender di main viewer (navigasi arrow kiri/kanan), tapi di **workspace tree (LeftDrawer)** akan muncul di section **"Other"** di bawah semua tier, bukan di tier yang sesuai. Untuk pengalaman navigasi yang rapi, daftarkan selalu ke TIERS yang tepat.

### Multi-project / Multi-golden-dir

Satu instalasi viewer bisa handle **banyak folder golden** dari proyek berbeda (misal `moneykitty/design/golden/` dan `initial-balance/design/golden/`). Tambahkan folder via drawer kiri (`\`).

`src/constants.ts` adalah **global** — berlaku untuk semua folder. Jika ada screen dari proyek lain yang tidak ada di TIERS, screen tersebut akan muncul di section **"Other"** di tree.

## 4. Jalankan Design Review Viewer

```bash
cd tools/screenshot_device_html
npm run review
```

Buka browser ke URL yang muncul (biasanya `http://localhost:5173`).

**Navigasi:**
- `←` `→` — prev/next screen
- `\` — toggle drawer sidebar
- Klik state tabs di panel kanan — switch state via postMessage
- Tombol burger (☰) — buka drawer daftar semua screen
- 📷 Capture — screenshot state saat ini

## 5. Screenshot (CLI)

### 5.1 Screenshot 1 file

```bash
cd tools/screenshot_device_html

# Dari file HTML local
npx tsx screenshot-v2.ts \
  --url ../docs/moneykitty/design/golden/nama_screen_spec.html \
  --width 390 --height 844 \
  --output ../docs/moneykitty/design/golden/nama_screen_spec.png

# Dari URL (jika sudah di-serve)
npx tsx screenshot-v2.ts \
  --url http://localhost:5173/screens/nama_screen_spec.html \
  --width 390 --height 844 \
  --output ../docs/moneykitty/design/golden/nama_screen_spec.png
```

### 5.2 Flag lengkap

| Flag | Default | Keterangan |
|------|---------|-----------|
| `--url` | (required) | Path file HTML atau URL |
| `--width` | 390 | Lebar viewport |
| `--height` | 844 | Tinggi viewport |
| `--output` | auto (`{name}_{w}x{h}.png`) | Path output PNG |
| `--browser` | chromium | `chrome` atau `chromium` |
| `--json` | — | Config inline JSON atau `-` untuk stdin |
| `--config` | — | Path ke file JSON config |

### 5.3 Batch screenshot dengan config JSON

```bash
echo '{"url":"./spec.html","width":390,"height":844,"output":"out.png"}' | \
  npx tsx screenshot-v2.ts --json -
```

## 6. Generate Variant HTML

Variant adalah file HTML terpisah untuk setiap state (empty, loading, error, edit, saving, dll).
Ini diperlukan untuk screenshot automation karena setiap state jadi 1 file independen.

```bash
cd tools/screenshot_device_html
node gen_variants.mjs
```

Script ini akan:
1. Scan semua `*_spec.html` di `GOLDEN_DIR`
2. Deteksi `<div id="state-*">` di dalam file
3. Generate file terpisah: `{base}_{state}.html` (misal `add_transaction_screen_spec_edit.html`)
4. Generate custom interactive variants (dropdown open, datepicker open, dark mode on, dll)

## 7. Batch Screenshot Semua Variant

```bash
cd tools/screenshot_device_html
bash batch_variants.sh
```

Script ini akan loop semua 29 variant HTML dan generate PNG via `screenshot-v2.ts`.

## 8. Workflow Lengkap (dari 0 ke golden PNG)

```
1. UX Designer buat HTML spec
   tools/screenshot_device_html/docs/moneykitty/design/golden/nama_screen_spec.html

2. Daftarkan di screen-metadata.json
   → tambah entry di "screens"

3. Daftarkan di src/constants.ts TIERS
   → tambah nama file ke array TIERS di tier yang sesuai
   → **WAJIB** — tanpa ini, screen hanya muncul di section "Other" di tree

4. Review di viewer
   npm run review
   → cek semua state: data, empty, loading, error

5. Screenshot state utama
   npx tsx screenshot-v2.ts --url ... --output nama_screen_spec.png

6. Generate variant + batch screenshot
   node gen_variants.mjs
   bash batch_variants.sh

7. Semua PNG siap di docs/moneykitty/design/golden/
```

## 9. Tips

- **Gunakan `min-height: 100vh`** di `.phone-frame` agar background selalu fill viewport
- **Gunakan CSS variables** dari BASELINE_SPEC.md untuk konsistensi warna
- **Jangan generate URL** — semua file HTML adalah static, di-serve dari filesystem
- **State nama harus konsisten** antara HTML `data-baseline-state`, `__baseline.states[]`, dan `screen-metadata.json`
- **Untuk interactive state** (dropdown, datepicker, toggle on) — buat custom variant HTML, jangan pakai state controller karena butuh DOM yang berbeda
