# CLAUDE.md

Design review viewer + screenshot tool untuk golden baseline HTML specs.

## Stack

React 18 + Vite 6 + TypeScript strict. No router, no state library — URL param `?file=` + React state.

## Commands

```bash
npm run review        # vite dev → http://localhost:4200
npm run dev           # same as review
npx tsc --noEmit      # type-check
```

## Architecture

Single-page design review viewer. Fetches `screen-metadata.json` from golden dir, renders phone-sized iframe (390×844) + metadata panel. State switching via `postMessage` to iframe (`__baseline.setState` contract) with variant-file fallback. Screenshot via `html2canvas` (CDN global, `window.html2canvas`).

```
src/
├── main.tsx / App.tsx        # Entry + root: keyboard shortcuts, state
├── types.ts                  # ScreenMeta, StateContext, Metadata
├── constants.ts              # TIERS, screenName()
├── index.css                 # Brand tokens + all component styles
├── hooks/
│   ├── useScreens.ts         # Fetch metadata, ordered list, URL routing
│   └── useToast.ts           # Toast state
└── components/
    ├── ScreenMenu.tsx         # Burger + dropdown (tier-organized screen list)
    ├── Viewer.tsx             # Toolbar + PhoneFrame + MetaPanel
    ├── PhoneFrame.tsx         # Iframe wrapper (forwardRef, postMessage)
    ├── MetaPanel.tsx          # Description, purpose, key elements, states
    ├── StateTabs.tsx          # State switching tabs + goal display
    ├── Summary.tsx            # All-screens table + batch capture trigger
    ├── CaptureProgress.tsx    # Batch capture loop with progress UI
    ├── Dock.tsx               # Floating bottom toolbar (tooltips on hover)
    ├── HelpModal.tsx          # Keyboard shortcuts modal
    └── Toast.tsx              # Notification
```

## Data flow

```
URL (?file=screen) → useScreens hook → orderedScreens + currentIndex
                                              ↓
                               App → Viewer → MetaPanel → StateTabs
                                        ↓
                                  PhoneFrame (iframe)
```

State switching: `activeState` di App → Viewer key={`${screen}-${activeState}`} remount → onLoad checks `__baseline.setState` contract → postMessage or variant file.

## Key patterns

- **CSS variables** for brand tokens (`--brand-accent: #C45353`, `--brand-surface: #FDFBF7`, etc.). No Tailwind, no inline styles.
- **forwardRef + useImperativeHandle** di PhoneFrame — parent akses iframe DOM via `getIframe()`.
- **BASELINE_SPEC.md** — kontrak teknis untuk HTML golden spec (`window.__baseline.setState`, `data-baseline-state`, `postMessage` listener). Setiap screen HTML wajib ikut kontrak ini.
- **postMessage casing**: `{ type: 'setState', state }` — lowercase, bukan `SET_STATE`.
- **Vite middleware** di `vite.config.ts` — `/api/capture` (POST, save PNG) + `/screens/*` (proxy ke golden dir).
- **GOLDEN_DIR** = `../../docs/moneykitty/design/golden/` (via env atau default).
- **html2canvas options**: selalu `{ width: 390, height: 844, scale: 2, useCORS: true, allowTaint: true }`.

## File naming

- Screens: `{name}_spec.html` di golden dir
- Variants: `{name}_spec_{state}.html` (untuk screen tanpa contract)
- Capture output: `phone_{screen}.png` (default) atau `phone_{screen}_{state}.png`

## Float layout

- Toolbar: fixed top-center (z-index 15)
- Burger: fixed top-left (z-index 16) — dropdown menu
- Dock: fixed bottom-center (z-index 15) — min-height 48px, tooltips on hover
- Main content: full viewport, pad-bottom 60px for dock
