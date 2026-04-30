# NEED_FIXING — Design Review Viewer Audit

> Review Date: 2026-04-30  
> Method: Code-only review + Playwright screenshots at 1440×900  
> Stack: Vite 6 + React 18 + Tailwind CSS v4 + supposed Untitled UI  
> Target audience: AI coding agent

---

## 1. Tailwind CSS v4 is installed but completely unused — CRITICAL

**What:** `package.json` has `tailwindcss@^4.2.4` and `@tailwindcss/vite`, but every style in the app lives inside a monolithic `src/index.css` (~2813 lines) using traditional BEM-style flat class names.  
**Why it matters:** Tailwind v4 brings CSS-first configuration (`@theme`), native cascade layers, and tree-shakeable utilities. Keeping 2800+ lines of hand-written CSS defeats the entire purpose of Tailwind and creates a massive maintenance burden.

**Evidence:**
- `src/index.css` lines 1-2813 are 100 % custom classes (`.burger-btn`, `.ld-*`, `.chat-*`, `.meta-panel`, etc.).
- Almost no Tailwind utility classes exist in any `.tsx` file.
- `@import "tailwindcss"` is present but only used for `@theme` custom colors.

**Action:**
1. Remove the monolithic `index.css` approach.
2. Migrate to Tailwind utility classes in JSX.
3. Keep only design tokens in `@theme` (colors, spacing, radius, shadows).
4. Use `Tailwind Merge` + `cn()` helper for conditional classes.

---

## 2. Massive CSS duplication inside `index.css` — CRITICAL

**What:** Several selectors are defined multiple times with overlapping rules.  
**Why it matters:** Increases bundle size, makes debugging fragile (which rule wins depends on source order), and complicates theming.

**Evidence:**
- `.ld-chevron` defined twice (line 218-224 and 402-408).
- `.ld-screen-item` defined twice (line 324-349 and 442-467).
- `.ld-tier-group` defined twice (line 313 and 431).
- `.ld-section-title`, `.ld-section-count`, `.ld-section-body`, `.ld-project-name` all appear twice.

**Action:**
- Deduplicate every repeated selector.
- Consolidate all `.ld-*` utilities into a single coherent block.
- Prefer CSS custom properties for values that change (colors, spacing).

---

## 3. Untitled UI is referenced but not actually integrated — CRITICAL

**What:** The codebase description says Untitled UI is part of the stack, yet zero Untitled UI components or tokens are used. Every component (Button, Input, Checkbox, Select, Badge, Modal) is a custom one-off under `src/components/base/`.

**Why it matters:** Untitled UI provides battle-tested React + Tailwind components with accessibility, dark mode tokens, and responsive patterns. Rolling everything from scratch wastes effort and produces less-polished UI.

**Evidence:**
- `src/components/base/buttons/button.tsx` is custom; not from Untitled UI.
- `src/components/base/inputs/input.tsx`, `select.tsx`, `checkbox.tsx`, `toggle.tsx` are all custom implementations.
- No Untitled UI design tokens (e.g. `text-sm`, `rounded-lg`, `border-gray-200`) are used.

**Action:**
1. Decide: either drop the Untitled UI reference or actually adopt it.
2. If adopting: import Untitled UI primitives and replace custom inputs/buttons.
3. If not adopting: remove the reference from docs and `package.json` to avoid confusion.

---

## 4. Z-index stacking nightmare — HIGH

**What:** Arbitrary `z-index` values are scattered across the CSS with no stacking-context strategy.

**Evidence:**
- `.cd-trigger` → `z-index: 16`
- `.ld-trigger` → `z-index: 16`
- `.left-drawer.floating` → `z-index: 50`
- `.modal-overlay` → `z-index: 50`
- `.device-dropdown` inside bottom bar → `z-index: 50`
- `chat-drawer` → `z-index: 40`
- `.ps-overlay` → `z-index: 60`
- `.sf-overlay` / `.cm-overlay` → `z-index: 200`
- `.toast` → `z-index: 100`
- `.ld-context-menu` → `z-index: 100`

**Why it matters:** With so many overlapping layers, adding a new modal or dropdown will inevitably break existing UI. The right drawer (`z-index: 40`) is actually *below* the left drawer overlay (`z-index: 50`), which feels semantically wrong.

**Action:**
- Establish a stacking-context hierarchy with CSS variables:
  ```css
  --z-base: 0;
  --z-drawer: 40;
  --z-modal: 50;
  --z-dropdown: 60;
  --z-toast: 70;
  --z-context-menu: 80;
  ```
- Apply these consistently. Never use magic numbers again.

---

## 5. Accessibility (a11y) gaps throughout — HIGH

**What:** Many interactive elements lack proper ARIA attributes, focus management, and semantic HTML.

**Evidence:**
- `BottomBar.tsx`: `aria-label` exists on buttons but no `role="toolbar"` on the container.
- `LeftDrawer.tsx`: No `aria-hidden` toggle when drawer is closed. Focus does not trap inside the drawer.
- `ConfirmModal.tsx`: Investigate if focus is trapped inside modal; no `aria-modal="true"` visible in CSS snapshots.
- `ChatDrawer.tsx`: Same lack of `aria-hidden` and focus trapping.
- Several buttons do not have `type="button"`, risking accidental form submission if ever wrapped in a `<form>`.
- Toast notifications are not announced to screen readers (`role="status"` / `aria-live` missing).
- iframe in `PhoneFrame.tsx` has `title="Phone preview"` (good) but no `loading="lazy"` or `sandbox` attribute review for a11y.

**Action:**
1. Add `aria-expanded` to all drawer toggles.
2. Add `aria-hidden={!open}` to drawer `aside` elements.
3. Implement focus trap for modals and drawers (or use React Aria / Radix Dialog).
4. Add `role="status"` and `aria-live="polite"` to Toast.
5. Add `type="button"` to every `<button>` that is not a submit.

---

## 6. Missing `type="button"` on many `<button>` elements — MEDIUM

**What:** JSX files contain many `<button>` elements without an explicit `type` attribute.

**Why it matters:** If any ancestor becomes a `<form>`, these buttons will unexpectedly submit. Default browser behavior for `<button>` is `type="submit"`.

**Evidence (grep search hits):**
- `LeftDrawer.tsx`: `className="burger-btn"`, `className="ld-pin-btn"`, `className="ld-close-btn"`, `className="ld-workspace-header"`, `className="ld-folder-header"`, etc.
- `BottomBar.tsx`: `bar-nav-btn`, `dock-tool`, `device-option`.
- `MetaPanel.tsx`: State tab buttons rendered by `StateTabs`.

**Action:**
- Run a codebase-wide regex to add `type="button"` to every interactive button that is not intentionally a submit.

---

## 7. Drawer closed-state content is still interactive — HIGH

**What:** `LeftDrawer` uses `width: 0` transition, but child content inside `.left-drawer-inner` retains `width: var(--sidebar-width)`. This means focusable elements inside a "closed" drawer can still receive keyboard focus and be interacted with.

**Evidence:**
```css
.left-drawer { width: 0; transition: width 0.25s ease; }
.left-drawer.open { width: var(--sidebar-width); }
.left-drawer-inner { width: var(--sidebar-width); }  /* always full width! */
```

**Action:**
- Add `visibility: hidden` (or `display: none`) when drawer is not open.
- Or set `overflow: hidden` on the drawer and `pointer-events: none` when closed.
- Best: use Radix or Headless UI primitives which handle this automatically.

---

## 8. Monolithic CSS file (~2813 lines) — MEDIUM

**What:** Every component style lives in one giant `index.css` instead of colocated with components.

**Why it matters:**
- Hard to maintain; deleting a component doesn't delete its styles.
- Merge conflicts when multiple devs touch CSS.
- No tree-shaking benefits; dead CSS stays in the bundle.

**Action:**
- Migrate to CSS Modules or Tailwind utility classes.
- Move component-specific styles beside the component file.
- Keep global tokens (colors, fonts, z-index scale) in `index.css` only.

---

## 9. Bare Tailwind `@theme` block has redundant / repeated colors — MEDIUM

**What:** The `@theme` block defines many overlapping colors that are never used via Tailwind utilities.

**Evidence:**
```css
@theme {
  --color-brand-solid: #C45353;
  --color-brand-solid_hover: #A84444;
  --color-brand-primary: #FDFBF7;
  --color-brand-secondary: #C45353;   /* same as brand-solid */
  --color-error-solid: #C45353;       /* same again */
  --color-fg-brand-secondary: #C45353;
  ...
}
```

**Why it matters:** Once Tailwind utilities are actually used, these duplicate names create confusion. Should I use `bg-brand-solid` or `bg-brand-secondary`?

**Action:**
- Consolidate to a single semantic palette:
  - `primary` (brand accent)
  - `secondary` (neutral text)
  - `surface` (card backgrounds)
  - `background` (page background)
- Map them to Tailwind utility names (`bg-primary`, `text-primary`, etc.).

---

## 10. Bottom bar pills overlap on small viewports — MEDIUM

**What:** Three floating pills are absolutely positioned:
- `.pill-info` → `left: 16px`
- `.pill-tools` → `left: 50%` with `transform: translateX(-50%)`
- `.pill-help` → `right: 16px`

**Why it matters:** On viewports narrower than ~1100px these pills collide. The center pill can overlap the left or right pill.

**Evidence:** The only responsive rule is `@media (max-width: 1100px) { .main-layout { flex-direction: column; } }`. There is zero handling for the bottom bar at small widths.

**Action:**
- Collapse the three pills into a single centered toolbar on narrow viewports.
- Or use a `@container` query on the bottom bar to switch layout.

---

## 11. Empty state lacks visual affordance — LOW

**What:** When no screens are loaded, the user sees only plain text:
> "No screens found. Press \ to open workspace drawer and add a project."

**Why it matters:** It looks unpolished and does not guide the user visually. Untitled UI has beautiful empty-state illustrations.

**Action:**
- Add an illustration/icon (e.g. `FolderOpen` or `Image` from lucide-react) above the text.
- Add a visible "Add Project" CTA button directly in the empty state, not just a keyboard shortcut hint.

---

## 12. `html2canvas` loaded from CDN with no fallback — MEDIUM

**What:** `index.html` includes:
```html
<script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
```

**Why it matters:** If the CDN is blocked/offline, `window.html2canvas` is undefined. The capture feature silently breaks (`typeof window.html2canvas !== "function"`).

**Action:**
- Install `html2canvas` via npm (`npm install html2canvas`).
- Import it explicitly in the module where it's used.
- Remove the CDN script tag from `index.html`.

---

## 13. `PhoneFrame` iframe `sandbox` is overly permissive — LOW

**What:** `sandbox="allow-scripts allow-same-origin"` effectively removes sandbox protection.

**Why it matters:** The iframe hosts arbitrary HTML design specs. If a spec file contains malicious JS, it inherits the same origin as the parent.

**Action:**
- Review whether `allow-same-origin` is truly required. The postMessage contract (`setState`) should work cross-origin if structured correctly.
- If same-origin is needed, document why in a code comment.

---

## 14. `ChatDrawer` default children is a dead placeholder — LOW

**What:** `ChatDrawer.tsx` lines 47-52 show a hardcoded placeholder:
```tsx
{children || (
  <>
    <h3>AI Chat</h3>
    <p className="sub">AI Chat panel — coming soon</p>
  </>
)}
```

**Why it matters:** The app passed real children (`DrawerTabs`) from `App.tsx`, so this is dead code. But if anything renders without children, users see a "coming soon" placeholder in production.

**Action:**
- Remove the fallback placeholder.
- Make `children` required (remove `?`) if the drawer should always have content.

---

## 15. State tabs in `MetaPanel` don't show state goal inline — LOW

**What:** `MetaPanel` renders `StateTabs` for the state context section, but the per-state goal is only visible inside the tab mechanism of `StateTabs`. If a user selects a state, the goal is shown inside `StateTabs` but not in the main `Description` area of `MetaPanel`.  
**Why it matters:** The `state-goal` CSS block exists (line 711-722 in `index.css`) but is not referenced in `MetaPanel.tsx`. The `activeCtx?.description` is shown, but `activeCtx?.goal` is never rendered in `MetaPanel`.

**Action:**
- In `MetaPanel.tsx`, after the Description section, conditionally render the `goal` text when `activeCtx?.goal` exists, using the existing `.state-goal` styles.

---

## 16. Summary page table uses `<code>` for naming convention display — LOW

**What:** The naming convention stat is wrapped in `<code className="num" style={{ fontSize: "16px" }}>` which is semantically odd.  
**Why it matters:** A `<code>` block usually implies copyable source code, but here it's used as a visual headline.

**Action:**
- Replace `<code>` with `<span>` and use `font-mono` (Tailwind) or a dedicated class.

---

## 17. `Toast` component is positioned behind potential overlays — LOW

**What:** Toast `z-index` is `100`, but `ConfirmModal` overlay is `z-index: 200`. If a confirmation modal is open and a toast fires, the toast appears *behind* the modal backdrop and is invisible.

**Action:**
- Move toast to a portal rendered at `document.body` level with the highest `z-index` in the app (`z-index: 9999` or use a stacking-context variable `var(--z-toast)`).

---

## Summary Priority Matrix

| Priority | Issue | File(s) |
|----------|-------|---------|
| CRITICAL | Tailwind v4 installed but unused | `index.css`, all `.tsx` |
| CRITICAL | Untitled UI not integrated | `src/components/base/*` |
| CRITICAL | CSS duplication | `index.css` |
| HIGH | Z-index chaos | `index.css` |
| HIGH | Drawer still interactive when closed | `index.css`, `LeftDrawer.tsx` |
| HIGH | Accessibility gaps | all interactive components |
| MEDIUM | Missing `type="button"` | all `.tsx` files |
| MEDIUM | Monolithic CSS | `index.css` |
| MEDIUM | Bare Tailwind `@theme` redundancy | `index.css` |
| MEDIUM | Bottom bar overlap on narrow screens | `index.css`, `BottomBar.tsx` |
| MEDIUM | html2canvas CDN no fallback | `index.html`, `App.tsx` |
| LOW | Empty state no illustration | `App.tsx` |
| LOW | iframe sandbox too permissive | `PhoneFrame.tsx` |
| LOW | ChatDrawer dead placeholder | `ChatDrawer.tsx` |
| LOW | State goal not shown in MetaPanel | `MetaPanel.tsx` |
| LOW | Summary naming convention `<code>` | `Summary.tsx` |
| LOW | Toast behind modal | `Toast.tsx`, `index.css` |
