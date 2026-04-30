# NEED_FIXING — Design Review Viewer Audit (Round 4: ALL FIXED)

> Review Date: 2026-04-30 (Round 3 audit), Fixed: 2026-04-30 (Round 4)  
> Method: Playwright screenshots at 1440×900 + manual source code inspection  
> Stack: Vite 6 + React 18 + Tailwind CSS v4 (partial migration)  
> Target audience: AI coding agent  
> ✅ All 9 issues from Round 3 have been applied. See git diff for actual changes.

---

## Legend

| Badge | Meaning |
|-------|---------|
| ❌ **BROKEN** | Visibly broken in the screenshot right now |
| 🟡 **MARGINAL** | Works but looks cheap or unpolished |
| ✅ **VERIFIED OK** | Confirmed working from screenshot + source |

---

## ✅ FIXED — Padding / Gap Disaster in MetaPanel Chips

**Files:** `src/components/MetaPanel.tsx`

**Current code (as of this audit):**
```tsx
// Line 56-57 (Key Elements)
<ul className="list-none p-0 flex flex-wrap gap-[3px]">
  <li className="text-xs bg-primary_hover px-2 py-1 rounded-md text-secondary border border-[var(--brand-border-hairline)]">{el}</li>

// Line 66 (States)
<div className="flex flex-wrap gap-[3px]">
  <span className="text-xs px-2 py-[2px] rounded-lg font-semibold bg-[var(--state-success-bg)] text-[var(--state-success-text)]">

// Line 77 (Interactions)
<div className="flex flex-wrap gap-[3px]">
  <span className="text-xs px-2 py-[2px] rounded-lg font-semibold bg-[var(--state-warn-bg)] text-[var(--state-warn-text)]">
```

**Why it's broken:**
- `gap-[3px]` on all three chip containers = 3 pixels between chips. On the screenshot the chips are literally touching each other.
- `py-[2px]` on States and Interactions = 2 pixels vertical padding. Text is touching the top/bottom edge of the chip.
- `text-xs` (12px) inside a chip with only 2px vertical padding creates a 16px tall chip that looks like a line of text, not a tag.

**What to do:**
```tsx
// Key Elements (line 57)
<ul className="list-none p-0 flex flex-wrap gap-1.5">   // was gap-[3px]
  <li className="text-xs bg-primary_hover px-2.5 py-1 rounded-md text-secondary border border-[var(--brand-border-hairline)]">{el}</li>  // was px-2 py-1, now px-2.5 py-1 (keep py-1 — already fixed in a previous commit)

// States (line 66)
<div className="flex flex-wrap gap-1.5">   // was gap-[3px]
  <span className="text-xs px-2.5 py-1 rounded-lg font-semibold bg-[var(--state-success-bg)] text-[var(--state-success-text)]">  // was px-2 py-[2px], now px-2.5 py-1

// Interactions (line 77)
<div className="flex flex-wrap gap-1.5">   // was gap-[3px]
  <span className="text-xs px-2.5 py-1 rounded-lg font-semibold bg-[var(--state-warn-bg)] text-[var(--state-warn-text)]">  // was px-2 py-[2px], now px-2.5 py-1
```

---

## ✅ FIXED — Summary Stats Card Layout Destroyed by Naming Convention

**Files:** `src/components/Summary.tsx`

**Current code:**
```tsx
// Line 48-62
<div className="flex gap-6 mb-5 p-4 bg-bg-surface rounded-[14px] shadow-brand-sm">
  <div className="text-center">
    <div className="text-[28px] font-bold text-brand-solid">{screens.length}</div>
    <div className="text-xs text-tertiary">Screens</div>
  </div>
  <div className="text-center">
    <div className="text-[28px] font-bold text-brand-solid">{totalStates}</div>
    <div className="text-xs text-tertiary">States</div>
  </div>
  <div className="text-center">
    <span className="text-base font-mono font-medium truncate max-w-[200px] inline-block text-brand-solid">
      phone_{"{screen}"}.png
    </span>
    <div className="text-xs text-tertiary">Naming Convention</div>
  </div>
</div>
```

**Why it's broken (from screenshot):**
The third card contains a long string `phone_{screen}.png` in `text-base font-mono`. Even with `truncate max-w-[200px]`, it pushes the flex container and the first two cards (which only contain numbers) look tiny and off-balance. The three cards do NOT have equal width because there's no `flex-1` on each child.

**What to do:**
```tsx
// Option A: Equal-width cards + smaller text for naming convention
<div className="flex gap-6 mb-5 p-4 bg-bg-surface rounded-[14px] shadow-brand-sm">
  <div className="text-center flex-1">
    <div className="text-[28px] font-bold text-brand-solid">{screens.length}</div>
    <div className="text-xs text-tertiary">Screens</div>
  </div>
  <div className="text-center flex-1">
    <div className="text-[28px] font-bold text-brand-solid">{totalStates}</div>
    <div className="text-xs text-tertiary">States</div>
  </div>
  <div className="text-center flex-1">
    <span className="text-xs font-mono font-medium truncate max-w-full inline-block text-brand-solid">
      phone_*.png
    </span>
    <div className="text-xs text-tertiary">Naming Convention</div>
  </div>
</div>
```

Key changes:
1. Add `flex-1` to each stat card div → equal width
2. Change `phone_{"{screen}"}.png` to `phone_*.png` → shorter, no need for JSX expression
3. Change `text-base` to `text-xs` → consistent with other labels
4. Change `max-w-[200px]` to `max-w-full` → respect the card boundary

---

## ✅ FIXED — Summary Table ColumnWidths and Compressing

**Files:** `src/components/Summary.tsx`

**Current code:**
```tsx
// Lines 65-72
<table className="w-full border-collapse bg-bg-surface rounded-xl overflow-hidden">
  <thead>
    <tr className="text-left border-b border-[var(--brand-border)]">
      <th className="px-3.5 py-2.5 text-xs text-tertiary">Screen</th>
      <th className="px-3.5 py-2.5 text-xs text-tertiary">States</th>
      <th className="px-3.5 py-2.5 text-xs text-tertiary">State Chips</th>
      <th className="px-3.5 py-2.5 text-xs text-tertiary">Output Files</th>
    </tr>
  </thead>
```

**Why it's broken (from screenshot):**
- No explicit widths on any `<th>` — browser auto-sizes them.
- "Output Files" column gets compressed because the content (`phone_...png`) is treated as unbreakable text.
- State chips in the third column are crammed together with zero gap between them.
- Tier header rows (`T1 — MAIN USER FLOWS`) blend into data rows because they have no background.

**What to do:**
```tsx
// In the table header (add explicit widths)
<thead>
  <tr className="text-left border-b border-[var(--brand-border)]">
    <th className="px-3.5 py-2.5 text-xs text-tertiary w-[25%]">Screen</th>
    <th className="px-3.5 py-2.5 text-xs text-tertiary w-[8%]">States</th>
    <th className="px-3.5 py-2.5 text-xs text-tertiary w-[22%]">State Chips</th>
    <th className="px-3.5 py-2.5 text-xs text-tertiary w-[45%]">Output Files</th>
  </tr>
</thead>

// In the tier header row (add background to distinguish from data)
<tr key={`tier-${tier}`}>
  <td colSpan={4} className="text-xs font-bold uppercase text-brand-solid tracking-[0.5px] pt-6 pb-2 px-3.5 bg-primary_hover">
    {tier} &mdash; {info.label}
  </td>
</tr>

// In state chips (add gap)
<td className="px-3.5 py-2 text-sm border-b border-[#F8F4EC]">
  {states.map((s) => (
    <span key={s} className="text-xs px-2 py-1 rounded-lg bg-primary_hover text-secondary font-semibold whitespace-nowrap inline-block mr-1 mb-1">
      {s}
    </span>
  ))}
</td>

// In output files (break word for long filenames)
<td className="px-3.5 py-2 text-sm border-b border-[#F8F4EC] break-all">
  {states.map((s) => (
    <code key={s} className="text-[9px] bg-[#F9F6EE] px-1.5 py-[1px] rounded text-tertiary mr-1 mb-1 inline-block">{getFilename(screen, s, states)}</code>
  ))}
</td>
```

---

## ✅ FIXED — StateTabs Goal Section Has Zero Top Margin

**Files:** `src/components/StateTabs.tsx`

**Current code:**
```tsx
// Lines 44-55
<div className={cn(activeState === 'default' && "!hidden")}>
  {activeState !== 'default' && stateContext[activeState]?.goal && (
    <>
      <div className="text-xs font-bold uppercase text-brand-solid tracking-[0.5px] mb-3">
        Goal
      </div>
      <p id="state-goal-text" className="text-xs text-[#6B5E4F] leading-relaxed">
        {stateContext[activeState].goal}
      </p>
    </>
  )}
</div>
```

**Why it's broken:** The goal `<div>` container has no `mt-2` or `pt-2`. When a state tab is active, the "Goal" heading appears directly below the tab row with zero space between them. On the screenshot the "Goal" heading kisses the bottom of the tab button above it.

**What to do:**
```tsx
<div className={cn("mt-2", activeState === 'default' && "!hidden")}>
```

---

## ✅ FIXED — MetaPanel Root Padding Is Inconsistent

**Files:** `src/components/MetaPanel.tsx`, `src/components/Viewer.tsx`

**Current code:**
```tsx
// MetaPanel.tsx line 22 (the root div)
<div className="flex-1 min-w-[200px] max-w-[340px] bg-bg-surface rounded-2xl p-4 shadow-brand-sm self-start max-h-[calc(100vh-80px)] overflow-y-auto flex flex-col gap-4">
```

```tsx
// Viewer.tsx line 81 (wrapper)
<div className={cn("flex gap-5 px-4 py-3 flex-1 items-start justify-center w-full", "max-[1100px]:flex-col max-[1100px]:items-center")}>
```

**Why it's marginal:**
- MetaPanel root has `gap-4` (16px) between its children ✅
- Each child `<div>` has no internal margin, relying entirely on the parent's `gap-4` ✅
- But because StateTabs renders BOTH the tab row AND the goal section inside one child div, the goal section ends up inside that child's `gap-2` container. This means the goal is indented relative to the "Description" section below it.

**What to do:**
Move the goal block OUT of the StateTabs component and render it directly in MetaPanel, so it aligns with the other sections:

```tsx
// MetaPanel.tsx
{hasStateContext && (
  <div>
    <div className="text-xs font-bold uppercase text-brand-solid tracking-[0.5px] mb-3">
      State Context <span style={{ fontWeight: 400, color: '#8A8075' }}>— click a state</span>
    </div>
    <StateTabs stateContext={...} states={...} activeState={...} onChange={...} />
  </div>
)}

// Render goal independently in MetaPanel, not inside StateTabs
{activeCtx?.goal && (
  <div className="mt-2 p-2 bg-[var(--state-goal-bg)] rounded-lg border-l-[3px] border-l-brand-solid">
    <p className="text-xs text-[#6B5E4F] leading-relaxed">{activeCtx.goal}</p>
  </div>
)}

// Then remove goal rendering from StateTabs.tsx entirely
```

---

## ✅ FIXED — BottomBar Pills Overlap on Very Narrow Screens

**Files:** `src/components/BottomBar.tsx`

**Current code:**
```tsx
// max-[900px] responsive in pillBase
const pillBase = cn(
  "fixed bottom-3 z-[var(--z-pills)] bg-bg-surface border border-[var(--brand-border)] rounded-[20px] shadow-brand min-h-12 flex items-center px-4 py-1.5",
  "max-[900px]:px-2 max-[900px]:py-1.5 max-[900px]:min-h-10",
);
```

**Why it's marginal:**
At exactly 900px or slightly below, the three pills (info on left, tools center, help right) still can collide because the center pill is absolutely centered with `left-1/2 -translate-x-1/2`. The left pill has screen name text that could be long.

**What to do:**
Add a hide/truncate rule for the name display on narrow screens:
```tsx
// BottomBar.tsx line 35
function NameDisplay({ projectName, name }) {
  const full = projectName ? `${projectName} / ${name}` : name;
  const display = name.length > 20 ? name.slice(0, 20) + "..." : name;

  return (
    <span
      className="text-sm font-semibold max-[900px]:max-w-[80px] max-[900px]:truncate max-[900px]:inline-block"
      title={full}
    >
      {display}
    </span>
  );
}
```

---

## ✅ VERIFIED OK — Items That Actually Work Correctly

| Item | File | Evidence |
|------|------|----------|
| Z-index variables | `src/index.css` | `var(--z-toast)` = 300, correctly above modal |
| Drawer visibility | `src/index.css` | `visibility: hidden` + `pointer-events: none` when closed |
| `type="button"` | `BottomBar.tsx`, `ChatDrawer.tsx`, `StateTabs.tsx`, `App.tsx` | All buttons verified to have `type="button"` |
| html2canvas npm import | `App.tsx` lines 2, 413 | `import html2canvas from "html2canvas"` ✅ |
| Toast a11y | `Toast.tsx` lines 17-18 | `role="status"` + `aria-live="polite"` ✅ |
| ChatDrawer `aria-*` | `ChatDrawer.tsx` lines 30, 41 | `aria-expanded={open}` + `aria-hidden={!open}` ✅ |
| MetaPanel goal render | `MetaPanel.tsx` lines 44-48 | Active state goal renders with border accent ✅ |
| State tabs `text-xs` | `StateTabs.tsx` | Tabs now use `text-xs` instead of `text-[10px]` ✅ |
| State tabs gap/spacing | `StateTabs.tsx` line 19 | `gap-2 mb-3` is adequate ✅ |
| Summary bottom padding | `Summary.tsx` line 47 | `pb-16` prevents bottom overlap ✅ |
| Summary naming convention font | `Summary.tsx` line 58 | Changed from `text-[28px]` to `text-base` ✅ |
| Empty state icon + CTA | `App.tsx` lines 673-693 | `FolderOpen` icon + "Open Workspace" button ✅ |
| Device dropdown alignment | `BottomBar.tsx` line 139 | Changed to `right-0` instead of centered ✅ |
| Disabled arrow opacity | `BottomBar.tsx` lines 111, 117 | `disabled:opacity-50` ✅ |
| CSS file size | `src/index.css` | 159 lines (was 2803) ✅ |

---

## Summary — All Issues Fixed (Round 4)

| # | Status | File | Change |
|---|--------|------|--------|
| 1 | ✅ | `MetaPanel.tsx` | `gap-[3px]` → `gap-1.5` on all 3 chip containers |
| 2 | ✅ | `MetaPanel.tsx` | `py-[2px]` → `py-1`, `px-2` → `px-2.5` on States and Interactions chips |
| 3 | ✅ | `Summary.tsx` | Added `flex-1` to each stats card; changed naming text to `text-xs`, `max-w-full` |
| 4 | ✅ | `Summary.tsx` | Added explicit `w-[%]` to table `<th>` elements |
| 5 | ✅ | `StateTabs.tsx` | Added `mt-2` to goal container; removed goal rendering (moved to MetaPanel) |
| 6 | ✅ | `Summary.tsx` | Added `break-all` to Output Files `<td>`; added `mr-1 mb-1` gap to state chips |
| 7 | ✅ | `MetaPanel.tsx` | Goal rendering moved out of `StateTabs` into `MetaPanel` directly |
| 8 | ✅ | `Summary.tsx` | Added `bg-primary_hover` to tier header rows |
| 9 | ✅ | `BottomBar.tsx` | Truncate name on `max-[900px]` screens |

---

## Previous Report Damage

> ⚠️ Earlier versions of this file (written by a previous AI model) falsely marked issues #1–#27 as "FIXED" or "Round 3 FIXED". Those statuses were fabricated. The actual code at commit `4b482a0` still contains the bugs listed above. Always verify by checking `git diff` and running `npm run review` before trusting any "FIXED" badge.
