/**
 * MoneyKitty Design Review Server
 *
 * Serves all HTML golden baselines in one local dev server.
 * Browse screens in phone-sized iframe with prev/next navigation.
 * Built-in screenshot capture via html2canvas — no Playwright needed.
 *
 * Usage: npx tsx tools/screenshot_device_html/dev-server.ts
 * Then open http://localhost:4200
 *
 * Features:
 *   - Phone-sized iframe viewer (390×844px)
 *   - Prev/Next navigation (arrow keys)
 *   - Interactive state context panel
 *   - Capture button → saves PNG to golden dir
 *   - Capture All → batch screenshot all screens
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = path.resolve(__dirname, '../../docs/moneykitty/design/golden');
const METADATA_PATH = path.join(GOLDEN_DIR, 'screen-metadata.json');
const PORT = 4200;

// Max request body size (5MB base64 PNG)
const MAX_BODY = 5 * 1024 * 1024;

interface StateContext { label: string; description: string; goal: string; }
interface ScreenMeta {
  name: string;
  tier: string;
  description: string;
  purpose: string;
  keyElements: string[];
  states: string[];
  interactions: string[];
  stateContext?: Record<string, StateContext>;
}
interface Metadata {
  meta: { version: string; lastUpdated: string; totalScreens: number };
  screens: Record<string, ScreenMeta>;
  components: Record<string, { name: string; description: string; appearsOn: string[] }>;
}

function loadMetadata(): Metadata {
  try {
    return JSON.parse(fs.readFileSync(METADATA_PATH, 'utf-8'));
  } catch {
    return { meta: { version: '0', lastUpdated: '', totalScreens: 0 }, screens: {}, components: {} };
  }
}

const TIERS: Record<string, { label: string; screens: string[] }> = {
  T1: {
    label: 'Main User Flows',
    screens: [
      'record_screen_spec',
      'transaction_list_screen_spec',
      'add_transaction_screen_spec',
      'wizard_add_transaction_screen_spec',
      'bills_screen_spec',
      'report_screen_spec',
      'assets_screen_spec',
    ],
  },
  T2: {
    label: 'Management',
    screens: [
      'category_manager_screen_spec',
      'add_category_screen_spec',
      'pocket_manager_screen_spec',
      'add_pocket_screen_spec',
      'ledger_manager_screen_spec',
      'add_ledger_screen_spec',
    ],
  },
  T3: {
    label: 'Settings & Security',
    screens: [
      'settings_screen_spec',
      'theme_customizer_screen_spec',
      'security_settings_screen_spec',
      'pin_setup_screen_spec',
    ],
  },
  T4: {
    label: 'Navigation & Shell',
    screens: [
      'floating_bottom_nav_spec',
      'user_screen_spec',
    ],
  },
};

function getScreenName(filename: string): string {
  return filename
    .replace(/_screen_spec$/, '')
    .replace(/_spec$/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace('Add ', 'Add/Edit ')
    .replace('Wizard Add Transaction', 'Wizard: Add Transaction')
    .replace('Floating Bottom Nav', 'Floating Bottom Nav (shell)')
    .replace('Pin Setup', 'PIN Setup/Change');
}

function getExistingHtmlFiles(): string[] {
  const files = fs.readdirSync(GOLDEN_DIR).filter((f) => f.endsWith('.html'));
  return files.map((f) => f.replace('.html', ''));
}

/** Ordered list of all screens by tier, only including those with HTML files */
function getOrderedScreenList(existingFiles: string[]): string[] {
  const result: string[] = [];
  for (const tier of Object.values(TIERS)) {
    for (const screen of tier.screens) {
      if (existingFiles.includes(screen)) result.push(screen);
    }
  }
  // Append any files not in tiers
  const tiered = Object.values(TIERS).flatMap((t) => t.screens);
  for (const f of existingFiles) {
    if (!tiered.includes(f)) result.push(f);
  }
  return result;
}

function renderIndex(existingFiles: string[]): string {
  const tierRows = Object.entries(TIERS)
    .map(([tier, { label, screens }]) => {
      const existing = screens.filter((s) => existingFiles.includes(s));
      if (existing.length === 0) return '';
      const rows = existing
        .map(
          (s) =>
            `<tr><td><a href="/viewer?file=${s}.html">${getScreenName(s)}</a></td><td><span class="badge">${tier}</span></td></tr>`
        )
        .join('');
      return `<tr class="tier-header"><td colspan="2">${tier} — ${label}</td></tr>${rows}`;
    })
    .join('');

  const tiered = Object.values(TIERS).flatMap((t) => t.screens);
  const untiered = existingFiles.filter((f) => !tiered.includes(f));
  const untieredRows = untiered
    .map(
      (f) =>
        `<tr><td><a href="/viewer?file=${f}.html">${getScreenName(f)}</a></td><td><span class="badge extra">EXTRA</span></td></tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MoneyKitty — Design Review</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Nunito', system-ui, sans-serif;
    background: #FEF6E9;
    color: #2B2B2B;
    padding: 40px 20px;
  }
  h1 { font-size: 28px; margin-bottom: 4px; }
  .subtitle { color: #8A8075; margin-bottom: 32px; font-size: 14px; }
  table {
    width: 100%; max-width: 640px; margin: 0 auto;
    border-collapse: collapse;
  }
  th, td { padding: 10px 16px; text-align: left; }
  .tier-header td {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    color: #C45353; padding-top: 24px; letter-spacing: 0.5px;
  }
  a {
    color: #2B2B2B; text-decoration: none; font-size: 16px;
    border-bottom: 1px solid transparent; transition: border-color 0.15s;
  }
  a:hover { border-bottom-color: #C45353; }
  .badge {
    font-size: 10px; padding: 2px 8px; border-radius: 10px;
    background: #F5EFE6; color: #8A8075; font-weight: 600;
  }
  .badge.extra { background: #FFEAE5; color: #C45353; }
  .stats {
    max-width: 640px; margin: 0 auto 32px;
    padding: 16px; background: #FDFBF7; border-radius: 16px;
    box-shadow: 0 2px 8px rgba(120,88,72,0.08);
    display: flex; gap: 32px; justify-content: center;
  }
  .stats div { text-align: center; }
  .stats .num { font-size: 32px; font-weight: 700; color: #C45353; }
  .stats .label { font-size: 12px; color: #8A8075; }
  .tip {
    max-width: 640px; margin: 32px auto 0;
    font-size: 12px; color: #8A8075; text-align: center;
  }
  .shortcut { font-family: monospace; background: #F5EFE6; padding: 1px 6px; border-radius: 4px; }
</style>
</head>
<body>
<h1 style="text-align:center">MoneyKitty — Design Review</h1>
<p class="subtitle" style="text-align:center">Golden Baseline Screens — click to view in phone frame with prev/next</p>

<div class="stats">
  <div><div class="num">${existingFiles.length}</div><div class="label">Screens</div></div>
  <div><div class="num">${Object.keys(TIERS).length}</div><div class="label">Tiers</div></div>
  <div><div class="num">:4200</div><div class="label">Port</div></div>
</div>

<table>
  ${tierRows}
  ${untieredRows ? `<tr class="tier-header"><td colspan="2">UNCATEGORIZED</td></tr>${untieredRows}` : ''}
</table>

<p class="tip">Click any screen to open viewer with phone-sized iframe. Use <span class="shortcut">←</span> <span class="shortcut">→</span> arrow keys or prev/next buttons to navigate.</p>
</body>
</html>`;
}

function renderViewer(file: string, existingFiles: string[]): string {
  const ordered = getOrderedScreenList(existingFiles);
  const currentIndex = ordered.findIndex((s) => s + '.html' === file);
  const total = ordered.length;

  if (currentIndex === -1) {
    return '<h1>404</h1><p>Screen not found in review list.</p>';
  }

  const metadata = loadMetadata();
  const screenKey = ordered[currentIndex];
  const meta: ScreenMeta | undefined = metadata.screens[screenKey];

  const prev = currentIndex > 0 ? ordered[currentIndex - 1] : null;
  const next = currentIndex < total - 1 ? ordered[currentIndex + 1] : null;
  const name = getScreenName(ordered[currentIndex]);
  const pos = currentIndex + 1;

  const metaPanel = meta ? `
<div class="meta-panel">
  <div class="meta-section">
    <div class="meta-label">Description</div>
    <p id="meta-desc">${meta.description}</p>
  </div>
  <div class="meta-section">
    <div class="meta-label">Purpose</div>
    <p id="meta-purpose">${meta.purpose}</p>
  </div>
  ${meta.stateContext ? `
  <div class="meta-section">
    <div class="meta-label">State Context <span style="font-weight:400;color:#8A8075">— click a state</span></div>
    <div class="state-tabs" id="state-tabs">
      <button class="state-tab active" data-state="default" onclick="showState('default')">Overview</button>
      ${Object.entries(meta.stateContext).map(([key, ctx]) =>
        `<button class="state-tab" data-state="${key}" onclick="showState('${key}')">${ctx.label}</button>`
      ).join('')}
    </div>
    <div id="state-goal" class="state-goal hidden">
      <div class="meta-label">Goal</div>
      <p id="state-goal-text"></p>
    </div>
  </div>
  <div id="state-context-data" style="display:none">
    ${Object.entries(meta.stateContext).map(([key, ctx]) =>
      `<script type="application/json" data-state="${key}">${JSON.stringify(ctx)}</script>`
    ).join('')}
  </div>
  ` : ''}
  <div class="meta-section">
    <div class="meta-label">Key Elements</div>
    <ul>${meta.keyElements.map((e) => `<li>${e}</li>`).join('')}</ul>
  </div>
  <div class="meta-row">
    <div class="meta-chip-group">
      <div class="meta-label">States</div>
      <div class="chips">${meta.states.map((s) => `<span class="chip state">${s}</span>`).join('')}</div>
    </div>
    <div class="meta-chip-group">
      <div class="meta-label">Interactions</div>
      <div class="chips">${meta.interactions.map((i) => `<span class="chip interaction">${i}</span>`).join('')}</div>
    </div>
  </div>
</div>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${name} — Review</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Nunito', system-ui, sans-serif;
    background: #F5EDE0;
    color: #2B2B2B;
    display: flex; flex-direction: column; align-items: center;
    min-height: 100vh;
    user-select: none;
  }

  .toolbar {
    width: 100%; max-width: 980px;
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px;
    background: #FDFBF7;
    border-bottom: 1px solid #F2EBE0;
    position: sticky; top: 0; z-index: 10;
  }
  .toolbar .name { font-size: 14px; font-weight: 600; }
  .toolbar .pos { font-size: 11px; color: #8A8075; }
  .toolbar .tier-chip {
    font-size: 10px; padding: 2px 8px; border-radius: 10px;
    background: #EAE1D4; color: #8A8075; font-weight: 600; margin-left: 6px;
  }

  .nav-btn {
    background: #F5EFE6; border: none; color: #2B2B2B;
    width: 36px; height: 36px; border-radius: 10px;
    font-size: 18px; cursor: pointer; display: flex;
    align-items: center; justify-content: center;
    transition: background 0.15s;
  }
  .nav-btn:hover { background: #EBE5DA; }
  .nav-btn:disabled { opacity: 0.3; cursor: default; }

  .main-layout {
    display: flex; gap: 24px; padding: 16px 20px;
    max-width: 980px; width: 100%;
    align-items: flex-start; justify-content: center;
  }

  .frame-wrapper {
    flex-shrink: 0;
    border-radius: 28px;
    box-shadow: 0 8px 32px rgba(120,88,72,0.15);
    overflow: hidden;
    background: #fff;
  }
  iframe {
    border: none; display: block;
    width: 390px; height: 844px;
  }

  .meta-panel {
    flex: 1; min-width: 240px; max-width: 380px;
    background: #FDFBF7;
    border-radius: 16px;
    padding: 20px;
    box-shadow: 0 2px 8px rgba(120,88,72,0.06);
    align-self: flex-start;
  }
  .meta-section { margin-bottom: 16px; }
  .meta-label {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    color: #C45353; letter-spacing: 0.5px; margin-bottom: 6px;
  }
  .meta-section p {
    font-size: 13px; line-height: 1.55; color: #4A4A4A;
  }
  .meta-section ul {
    list-style: none; padding: 0;
    display: flex; flex-wrap: wrap; gap: 4px;
  }
  .meta-section li {
    font-size: 12px; background: #F5EFE6; padding: 3px 10px;
    border-radius: 8px; color: #5A5A5A;
  }
  .meta-row { display: flex; flex-direction: column; gap: 12px; }
  .chips { display: flex; flex-wrap: wrap; gap: 4px; }
  .chip {
    font-size: 11px; padding: 2px 10px; border-radius: 10px; font-weight: 600;
  }
  .chip.state { background: #D4F5E4; color: #2D6A4F; }
  .chip.interaction { background: #FFF1D6; color: #8A6D3B; }

  .state-tabs { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
  .state-tab {
    font-family: 'Nunito', system-ui, sans-serif;
    font-size: 11px; font-weight: 600;
    padding: 4px 12px; border-radius: 12px;
    border: 1px solid #EBE5DA; background: #fff; color: #8A8075;
    cursor: pointer; transition: all 0.15s;
  }
  .state-tab:hover { background: #F5EFE6; color: #2B2B2B; }
  .state-tab.active { background: #C45353; color: #fff; border-color: #C45353; }
  .state-goal { margin-top: 10px; padding: 10px; background: #FFF9F5; border-radius: 10px; border-left: 3px solid #C45353; }
  .state-goal.hidden { display: none; }
  .state-goal p { font-size: 12px; color: #6B5E4F; line-height: 1.5; }

  /* Responsive: stack vertically on narrow screens */
  @media (max-width: 820px) {
    .main-layout { flex-direction: column; align-items: center; }
    .meta-panel { max-width: 100%; width: 100%; }
  }
  /* Scale iframe on short screens */
  @media (max-height: 900px) {
    iframe { width: 340px; height: 735px; }
    .frame-wrapper { border-radius: 24px; }
  }
  @media (max-height: 780px) {
    iframe { width: 300px; height: 650px; }
    .frame-wrapper { border-radius: 20px; }
  }

  .footer {
    display: flex; gap: 0;
    padding-bottom: 16px;
  }
  .footer .nav-btn {
    width: auto; padding: 8px 20px; gap: 6px;
    font-size: 13px; font-weight: 600;
    border-radius: 12px;
  }
  .footer .nav-btn:first-child { border-radius: 12px 0 0 12px; border-right: 1px solid #EBE5DA; }
  .footer .nav-btn:last-child { border-radius: 0 12px 12px 0; }
  .footer .nav-btn:only-child { border-radius: 12px; }

  a.home {
    color: #8A8075; text-decoration: none; font-size: 12px;
    margin-left: 8px;
  }
  a.home:hover { color: #C45353; }

  .shortcut-hint {
    font-size: 10px; color: #C2B8A8; text-align: center; padding-bottom: 12px;
  }

  .capture-btn {
    background: #C45353; color: #fff; border: none;
    font-family: 'Nunito', system-ui, sans-serif;
    font-size: 11px; font-weight: 700;
    padding: 6px 14px; border-radius: 10px;
    cursor: pointer; transition: background 0.15s;
    display: flex; align-items: center; gap: 4px;
  }
  .capture-btn:hover { background: #A84444; }
  .capture-btn:disabled { background: #D4A0A0; cursor: default; }
  .capture-toast {
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: #2B2B2B; color: #fff; font-size: 13px; font-weight: 600;
    padding: 10px 24px; border-radius: 12px;
    opacity: 0; transition: opacity 0.25s; pointer-events: none; z-index: 100;
  }
  .capture-toast.show { opacity: 1; }
  .capture-toast.ok { background: #2D6A4F; }
  .capture-toast.err { background: #C45353; }
</style>
</head>
<body>

<div class="toolbar">
  <div style="display:flex;align-items:center;gap:8px">
    <a class="home" href="/">← Index</a>
  </div>
  <div style="text-align:center">
    <div class="name">${name}<span class="tier-chip">${meta?.tier ?? ''}</span></div>
    <div class="pos">${pos} of ${total}</div>
  </div>
  <div style="display:flex;align-items:center;gap:6px">
    <button class="capture-btn" onclick="captureScreen()" title="Capture PNG">📷 Capture</button>
    <button class="nav-btn" onclick="goPrev()"${prev ? '' : ' disabled'} title="Previous (←)">◀</button>
    <button class="nav-btn" onclick="goNext()"${next ? '' : ' disabled'} title="Next (→)">▶</button>
  </div>
</div>

<div class="main-layout">
  <div class="frame-wrapper">
    <iframe src="/${file}" id="frame" sandbox="allow-scripts allow-same-origin"></iframe>
  </div>
  ${metaPanel}
</div>

<div class="footer">
  <button class="nav-btn" onclick="goPrev()"${prev ? '' : ' disabled'}>◀ Prev</button>
  <button class="nav-btn" onclick="goNext()"${next ? '' : ' disabled'}>Next ▶</button>
</div>
<p class="shortcut-hint">Arrow keys ← → to navigate &nbsp;|&nbsp; Esc back to index</p>

<script>
  const PREV = ${prev ? `'/viewer?file=${prev}.html'` : 'null'};
  const NEXT = ${next ? `'/viewer?file=${next}.html'` : 'null'};
  function goPrev() { if (PREV) location.href = PREV; }
  function goNext() { if (NEXT) location.href = NEXT; }

  const defaultDesc = ${JSON.stringify(meta?.description ?? '')};
  const defaultPurpose = ${JSON.stringify(meta?.purpose ?? '')};
  const stateContexts = {};
  document.querySelectorAll('script[data-state]').forEach(el => {
    try { stateContexts[el.dataset.state] = JSON.parse(el.textContent); } catch(e) {}
  });

  function showState(stateKey) {
    document.querySelectorAll('.state-tab').forEach(t => t.classList.remove('active'));
    const activeTab = document.querySelector('.state-tab[data-state="' + stateKey + '"]');
    if (activeTab) activeTab.classList.add('active');

    const descEl = document.getElementById('meta-desc');
    const purposeEl = document.getElementById('meta-purpose');
    const goalDiv = document.getElementById('state-goal');
    const goalText = document.getElementById('state-goal-text');

    if (stateKey === 'default' || !stateContexts[stateKey]) {
      descEl.textContent = defaultDesc;
      purposeEl.textContent = defaultPurpose;
      if (goalDiv) goalDiv.classList.add('hidden');
    } else {
      const ctx = stateContexts[stateKey];
      descEl.textContent = ctx.description;
      purposeEl.textContent = ctx.description;
      if (goalDiv && ctx.goal) {
        goalDiv.classList.remove('hidden');
        goalText.textContent = ctx.goal;
      }
    }
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
    if (e.key === 'Escape') { location.href = '/'; }
  });
</script>

</body>
</html>`;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.css': 'text/css',
  '.js': 'application/javascript',
};

const server = http.createServer((req, res) => {
  const parsed = new URL(req.url ?? '/', 'http://localhost');
  const pathname = parsed.pathname;
  const existingFiles = getExistingHtmlFiles();

  // ---- Capture API ----
  if (pathname === '/capture' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; if (body.length > MAX_BODY) req.destroy(); });
    req.on('end', () => {
      try {
        const { filename, data } = JSON.parse(body);
        if (!filename || !data) throw new Error('Missing filename or data');
        // Sanitize filename
        const safe = path.basename(filename.replace(/\.png$/i, '') + '.png');
        if (!safe.endsWith('.png')) throw new Error('Invalid filename');
        const outPath = path.join(GOLDEN_DIR, safe);
        const base64 = data.replace(/^data:image\/png;base64,/, '');
        fs.writeFileSync(outPath, Buffer.from(base64, 'base64'));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, path: safe, size: base64.length }));
      } catch (e: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderIndex(existingFiles));
    return;
  }

  if (pathname === '/viewer') {
    const file = parsed.searchParams.get('file') ?? '';
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderViewer(file, existingFiles));
    return;
  }

  const filePath = path.join(GOLDEN_DIR, pathname.replace(/^\//, ''));
  const ext = path.extname(filePath);

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>404</h1><p>Screen not found. <a href="/">Back to index</a></p>');
    return;
  }

  res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  const count = getExistingHtmlFiles().length;
  console.log(`\n  MoneyKitty Design Review\n  http://localhost:${PORT}\n`);
  console.log(`  Serving ${count} screens from:`);
  console.log(`  ${GOLDEN_DIR}`);
  console.log(`\n  IFRAME: 390×844px phone frame`);
  console.log(`  NAV:    ← → arrow keys or prev/next buttons`);
  console.log(`  HOME:   Esc or click "Index"\n`);
});
