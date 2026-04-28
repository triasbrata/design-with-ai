# Changelog

## 2026-04-28 — Rectangle Marker + AI Context

**Session:** caveman mode, team `engineers` (2 agents), then team `eng` (2 agents).

### Done

1. **Rectangle marker overlay** (commit `2a2e44d`)
   - New `MarkerOverlay.tsx` — click-drag on phone screen draws dashed red rectangle with size label
   - Marker toggle button in `BottomBar` (Square icon)
   - State in `App.tsx`: `markerRect`, `markerContext`, `markerMode` (derived from `dockTool`)
   - Escape clears marker, screen change resets marker
   - CSS: `.phone-container`, `.marker-overlay`, `.marker-rect`, `.marker-size-label`
   - `extractMarkerContext.ts` — client-side DOM extractor via `elementFromPoint` + CSS selector builder (3-level) + `data-baseline-state` ancestor detection
   - ChatPanel shows marker badge: `Marked: <tag> 'text...'` + Clear button
   - ACP vite plugin + standalone agent parse marker context, inject into Claude prompt as `## Marked Area Context`

2. **File path context to AI chat** — committed (`8c3592e`)
   - ChatPanel sends `queryParam: ?file={screen}` in context body
   - ACP vite plugin builds `## File Location` section with full spec file path + URL query param
   - Standalone agent parses `__file_context__` prefix

3. **BottomBar name truncation** — committed (`a445799`)
   - `NameDisplay` component: `fullName > 50` → `... / {name}`, hover `title={fullName}`
   - Format: `[projectName / screenName]` → truncated at 50 chars with tooltip

### State

- **Committed:** rectangle marker + ACP context extraction (`2a2e44d`), file context (`8c3592e`), BottomBar truncation (`a445799`)
- **Uncommitted:** none
- **Typecheck:** clean (`npx tsc --noEmit` — no errors)
- **App:** not running (needs `npm run dev`)

### Verification (2026-04-28, team `finish-changelog`)

- **TypeScript:** clean
- **Code review:** ChatPanel marker badge + BottomBar marker toggle wired correctly
- **Interactive e2e:** pending — dev server not running, requires `npm run dev` then manual click-drag test on phone screen
