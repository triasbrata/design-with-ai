#!/usr/bin/env node

/**
 * gen_variants.mjs — Generate variant HTML files for every interactive state.
 *
 * For each existing golden HTML spec file, this script:
 * 1. Finds all state divs (id="state-*")
 * 2. Creates a variant HTML file showing only that state (no JS needed)
 * 3. Names it {base}_{state}.html
 *
 * Also generates custom HTML for interactive UI elements:
 * - Dropdown open state (simulated open select)
 * - Date picker open state (calendar popup overlay)
 * - Toggle on states (dark mode, biometric, etc.)
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join, dirname, basename, extname } from 'path';

const GOLDEN_DIR = '/Users/triasbratayudhana/dev/moneykitty/docs/moneykitty/design/golden';
const OUT_DIR = GOLDEN_DIR; // write variants next to originals

// ─── Helpers ────────────────────────────────────────────────────────────────────

function stripExt(name) {
  return name.replace(/\.[^.]+$/, '');
}

function readHtml(path) {
  return readFileSync(path, 'utf-8');
}

function writeHtml(path, content) {
  writeFileSync(path, content, 'utf-8');
  console.log(`  Created: ${basename(path)}`);
}

/**
 * Create a variant where only the specified state div is visible.
 * Removes state-controls, other state divs, and the showState JS function.
 */
function createStateVariant(html, targetState) {
  let result = html;

  // 1. Remove state-controls div
  result = result.replace(
    /<div class="state-controls">[\s\S]*?<\/div>\s*\n*/,
    ''
  );

  // 2. Find all state divs — remove all EXCEPT the target
  // Match <div id="state-XXX" ...>...</div>
  const stateDivRegex = /<div id="state-(\w+)"[^>]*>[\s\S]*?<\/div>\s*(?=\n|$)/g;
  let match;
  const replacements = [];

  while ((match = stateDivRegex.exec(result)) !== null) {
    const stateName = match[1];
    const fullDiv = match[0];

    if (stateName === targetState) {
      // Keep this one — remove style="display:none" if present
      const cleaned = fullDiv.replace(/\s+style="display:\s*none;?"/i, '');
      replacements.push({ from: fullDiv, to: cleaned });
    } else {
      // Remove other state divs
      replacements.push({ from: fullDiv, to: '' });
    }
  }

  for (const { from, to } of replacements) {
    result = result.replace(from, to);
  }

  // 3. Remove JS showState function and the event handler attachment
  result = result.replace(
    /<script>[\s\S]*?function\s+showState[\s\S]*?<\/script>/,
    '<script>// static variant — no state switching needed</script>'
  );

  // 4. Clean up double blank lines, trailing spaces
  result = result.replace(/\n{3,}/g, '\n\n');

  return result;
}

/**
 * Generate custom HTML for dropdown-open state on a screen.
 * This simulates what the user sees when tapping a <select> field.
 */
function generateDropdownOpen(baseName, baseHtml) {
  // Find the original dropdown HTML and create a version with a visible option list
  let html = baseHtml;

  // Remove state controls if present
  html = html.replace(/<div class="state-controls">[\s\S]*?<\/div>\s*\n*/, '');

  // Remove showState JS if present
  html = html.replace(
    /<script>[\s\S]*?function\s+showState[\s\S]*?<\/script>/,
    '<script>// static variant</script>'
  );

  // Replace native <select> dropdown with a simulated open version
  // Find all select.dropdown-field elements
  html = html.replace(
    /<select class="dropdown-field">([\s\S]*?)<\/select>/g,
    (match, optionsContent) => {
      // Extract options
      const optionRegex = /<option(?:\s+selected)?>([^<]+)<\/option>/g;
      const options = [];
      let optMatch;
      while ((optMatch = optionRegex.exec(optionsContent)) !== null) {
        options.push(optMatch[1]);
      }

      const selectedOption = options[0] || '';
      const listItems = options.map((opt, i) =>
        `<div class="dropdown-item${i === 0 ? ' selected' : ''}" onclick="event.stopPropagation()">${opt}</div>`
      ).join('');

      return `
        <div class="dropdown-container" style="position:relative;margin-bottom:20px;">
          <div class="dropdown-field dropdown-field-open">
            ${selectedOption}
            <span class="material-symbols-rounded dropdown-arrow">arrow_drop_up</span>
          </div>
          <div class="dropdown-menu">
            ${listItems}
          </div>
        </div>`;
    }
  );

  // Replace <select class="dropdown"> (simpler dropdown used in pocket/ledger forms)
  html = html.replace(
    /<select class="dropdown">([\s\S]*?)<\/select>/g,
    (match, optionsContent) => {
      const optionRegex = /<option(?:\s+selected)?>([^<]+)<\/option>/g;
      const options = [];
      let optMatch;
      while ((optMatch = optionRegex.exec(optionsContent)) !== null) {
        options.push(optMatch[1]);
      }

      const selectedOption = options[0] || '';
      const listItems = options.map((opt, i) =>
        `<div class="dropdown-item${i === 0 ? ' selected' : ''}">${opt}</div>`
      ).join('');

      return `
        <div class="dropdown-container" style="position:relative;">
          <div class="dropdown-field dropdown-field-open">
            ${selectedOption}
            <span class="material-symbols-rounded dropdown-arrow">arrow_drop_up</span>
          </div>
          <div class="dropdown-menu">
            ${listItems}
          </div>
        </div>`;
    }
  );

  // Don't forget the pocket chip in add_pocket screen
  // Add dropdown menu styles
  const dropdownStyles = `
  <style>
    .dropdown-container { position: relative; width: 100%; }
    .dropdown-field-open {
      width: 100%;
      padding: 12px;
      border: 1px solid var(--border-hairline);
      border-radius: 12px 12px 0 0;
      font-family: 'Nunito', sans-serif;
      font-size: 14px;
      color: var(--text-primary);
      background: var(--bg-surface);
      cursor: pointer;
      margin-bottom: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .dropdown-arrow { font-size: 20px; color: var(--text-secondary); }
    .dropdown-menu {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      border-top: none;
      border-radius: 0 0 12px 12px;
      box-shadow: 0 8px 24px rgba(160,120,90,0.15);
      z-index: 100;
      overflow: hidden;
    }
    .dropdown-item {
      padding: 12px;
      font-family: 'Nunito', sans-serif;
      font-size: 14px;
      color: var(--text-primary);
      cursor: pointer;
      border-bottom: 1px solid var(--border-hairline);
    }
    .dropdown-item:last-child { border-bottom: none; }
    .dropdown-item.selected { background: var(--primary-container); font-weight: 600; }
    .dropdown-item:hover { background: rgba(196,83,83,0.05); }
  </style>`;

  // Insert styles before closing </head>
  html = html.replace('</head>', dropdownStyles + '\n</head>');

  // Also handle the unique dropdown in add_pocket_screen
  // This screen has a `type-grid` that serves as pocket type selector
  // We need to show the ledger dropdown inside a card as open too

  return html;
}

/**
 * Generate custom HTML for date-picker open state on Add Transaction screen.
 */
function generateDatePickerOpen(baseName, baseHtml) {
  let html = baseHtml;

  // Remove state controls
  html = html.replace(/<div class="state-controls">[\s\S]*?<\/div>\s*\n*/, '');

  // Remove showState JS
  html = html.replace(
    /<script>[\s\S]*?function\s+showState[\s\S]*?<\/script>/,
    '<script>// static variant</script>'
  );

  // Remove other state divs, keep only state-add
  const stateDivRegex = /<div id="state-(\w+)"[^>]*>[\s\S]*?<\/div>\s*(?=\n|$)/g;
  let match;
  const replacements = [];
  while ((match = stateDivRegex.exec(html)) !== null) {
    if (match[1] !== 'add') {
      replacements.push({ from: match[0], to: '' });
    } else {
      const cleaned = match[0].replace(/\s+style="display:\s*none;?"/i, '');
      replacements.push({ from: match[0], to: cleaned });
    }
  }
  for (const { from, to } of replacements) {
    html = html.replace(from, to);
  }

  // Replace date button with a simulated date picker popup
  const calendarHTML = `
  <div style="position:relative;margin-bottom:20px;">
    <!-- Date button (as if tapped) -->
    <div class="date-btn date-btn-active" style="display:flex;align-items:center;gap:8px;padding:10px 16px;border:1px solid var(--primary);border-radius:12px 12px 0 0;background:var(--bg-surface);font-family:'Nunito',sans-serif;font-size:14px;color:var(--text-primary);cursor:pointer;">
      <span class="material-symbols-rounded" style="font-size:18px;color:var(--primary);">calendar_today</span>
      April 28, 2026
      <span class="material-symbols-rounded" style="font-size:18px;color:var(--text-secondary);margin-left:auto;">arrow_drop_up</span>
    </div>
    <!-- Calendar popup -->
    <div style="position:absolute;top:100%;left:0;right:0;background:var(--bg-surface);border:1px solid var(--border-hairline);border-top:none;border-radius:0 0 16px 16px;box-shadow:0 8px 32px rgba(160,120,90,0.18);z-index:100;padding:16px;overflow:hidden;">
      <!-- Month/Year header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <span class="material-symbols-rounded" style="font-size:20px;color:var(--text-secondary);cursor:pointer;">chevron_left</span>
        <span style="font-size:15px;font-weight:700;color:var(--text-primary);">April 2026</span>
        <span class="material-symbols-rounded" style="font-size:20px;color:var(--text-secondary);cursor:pointer;">chevron_right</span>
      </div>
      <!-- Day names -->
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:8px;text-align:center;">
        <span style="font-size:11px;font-weight:600;color:var(--text-secondary);">M</span>
        <span style="font-size:11px;font-weight:600;color:var(--text-secondary);">T</span>
        <span style="font-size:11px;font-weight:600;color:var(--text-secondary);">W</span>
        <span style="font-size:11px;font-weight:600;color:var(--text-secondary);">T</span>
        <span style="font-size:11px;font-weight:600;color:var(--text-secondary);">F</span>
        <span style="font-size:11px;font-weight:600;color:var(--text-secondary);">S</span>
        <span style="font-size:11px;font-weight:600;color:var(--text-secondary);">S</span>
      </div>
      <!-- Days grid -->
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center;">
        ${['','','',1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30].map(d => {
          if (d === '') return '<span style="height:32px;"></span>';
          const isSelected = d === 28;
          const isToday = d === 28;
          return `<span style="display:flex;align-items:center;justify-content:center;height:32px;width:32px;margin:0 auto;border-radius:50%;font-size:13px;font-weight:${isSelected?'700':'400'};color:${isSelected?'#fff':isToday?'var(--primary)':'var(--text-primary)'};background:${isSelected?'var(--primary)':'transparent'};">${d}</span>`;
        }).join('\n        ')}
      </div>
      <!-- Action buttons -->
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button style="flex:1;padding:8px;border:1px solid var(--border-hairline);border-radius:12px;background:transparent;font-family:'Nunito',sans-serif;font-size:13px;color:var(--text-secondary);cursor:pointer;">Cancel</button>
        <button style="flex:1;padding:8px;background:var(--primary);border:none;border-radius:12px;color:#fff;font-family:'Nunito',sans-serif;font-size:13px;font-weight:600;cursor:pointer;">OK</button>
      </div>
    </div>
  </div>`;

  // Replace the original date button with our calendar popup
  html = html.replace(
    /<button class="date-btn">[\s\S]*?<\/button>/,
    calendarHTML
  );

  return html;
}

/**
 * Generate variant for Settings screen with Dark mode toggle ON.
 */
function generateSettingsDarkModeOn(html) {
  let result = html;
  // Find the toggle--off for dark theme and make it toggle--on
  // The dark theme toggle is the second toggle in the file
  result = result.replace(
    /(<li class="settings-item">[\s\S]*?Dark theme[\s\S]*?<div class="toggle )toggle--off/g,
    '$1toggle--on'
  );
  return result;
}

/**
 * Generate variant for Security Settings with Biometric toggle ON.
 */
function generateSecurityBiometricOn(html) {
  let result = html;
  // Find the toggle-switch (first one, for Biometric) and add .on class
  result = result.replace(
    /(<div class="setting-item">[\s\S]*?Biometric Lock[\s\S]*?<div class="toggle-switch")>/,
    '$1 class="toggle-switch on">'
  );
  return result;
}

/**
 * Generate variant for Theme Customizer with Dark mode ON.
 */
function generateThemeDarkModeOn(html) {
  let result = html;
  // Find the toggle-switch and add .on class
  result = result.replace(
    /(<div class="toggle-switch")([\s\S]*?<div class="toggle-thumb)/,
    '$1 class="toggle-switch on"$2'
  );
  return result;
}

/**
 * Generate variant for Nav tab: show specific tab as active.
 */
function generateNavVariant(baseHtml, activeIndex) {
  const tabLabels = ['Record', 'Bills', 'Assets', 'Settings'];
  const pillColors = ['pill-record', 'pill-bills', 'pill-assets', 'pill-settings'];
  const activeLabel = tabLabels[activeIndex];

  let html = baseHtml;
  // Update the content area
  html = html.replace(
    /<h1>FloatingBottomNav<\/h1>/,
    `<h1>Tab: ${activeLabel}</h1>`
  );
  html = html.replace(
    /<p>Golden Baseline[\s\S]*?<\/p>/,
    `<p>Active tab: "${activeLabel}" — preview below</p>`
  );

  // Update the tab switcher buttons
  for (let i = 0; i < 4; i++) {
    const btnClass = i === activeIndex ? 'tab-btn-active' : 'tab-btn-inactive';
    html = html.replace(
      new RegExp(`(<button class="tab-btn[^"]*" data-index="${i}")`),
      `<button class="tab-btn ${btnClass}" data-index="${i}"`
    );
  }

  // Update the nav tabs
  // First, find the nav capsule section
  const navStart = html.indexOf('<div class="nav-capsule"');
  const navEnd = html.indexOf('</div>', html.indexOf('</div>', html.indexOf('</div>', navStart) + 1) + 1) + 6;

  const navSection = html.substring(navStart, navEnd);

  // For each tab in nav
  for (let i = 0; i < 4; i++) {
    const isActive = i === activeIndex;
    const navTabRegex = new RegExp(
      `(<div class="nav-tab[^"]*" data-index="${i}"[\\s\\S]*?</div>\\s*</div>)`
    );

    // Find this tab in the nav section
    const tabMatch = navSection.match(navTabRegex);
    if (tabMatch) {
      const oldTab = tabMatch[1];
      let newTab;

      if (isActive) {
        // Make this tab active
        newTab = oldTab
          .replace(/nav-tab-inactive/g, 'nav-tab-active')
          .replace(
            /(<div class="nav-tab-inner")/,
            `<div class="nav-tab-inner ${pillColors[i]}"`
          );
        // Make sure label is visible
        newTab = newTab.replace(
          /(<span class="nav-tab-label">[^<]+<\/span>)/,
          (m) => m
        );
      } else {
        // Make this tab inactive
        newTab = oldTab
          .replace(/nav-tab-active/g, 'nav-tab-inactive')
          .replace(/class="nav-tab-inner[^"]*"/, 'class="nav-tab-inner"');
      }

      html = html.replace(oldTab, newTab);
    }
  }

  // Remove the JS showState/switching functions since we're static
  html = html.replace(
    /<script>[\s\S]*?function switchTab[\s\S]*?<\/script>/,
    '<script>// static nav variant</script>'
  );

  return html;
}

// ─── Main ────────────────────────────────────────────────────────────────────────

function main() {
  const files = readdirSync(GOLDEN_DIR).filter(f => f.endsWith('_spec.html'));

  console.log('=== Generating state variants ===\n');

  // Track what we generate
  const generatedVariants = [];

  for (const file of files) {
    // Skip variant files (generated by previous runs or custom interactive states)
    if (file.match(/_spec_(edit|saving|empty|loading|error|step2|step3|step4|confirm|change|dropdown|datepicker|dark|biometric|tab_)/)) {
      continue;
    }
    const filePath = join(GOLDEN_DIR, file);
    const baseName = stripExt(file); // e.g. "add_transaction_screen_spec"
    const html = readHtml(filePath);

    // Skip files without state-controls (they're static screens)
    if (!html.includes('state-controls')) {
      continue;
    }

    // Find all state divs
    const stateIds = [];
    const stateRegex = /id="state-(\w+)"/g;
    let sm;
    while ((sm = stateRegex.exec(html)) !== null) {
      stateIds.push(sm[1]);
    }

    // Also find which state is visible by default (the one without display:none)
    let defaultState = null;
    for (const sid of stateIds) {
      const stateDivRegex = new RegExp(`<div id="state-${sid}"[^>]*>`);
      const dm = html.match(stateDivRegex);
      if (dm && !dm[0].includes('display:none')) {
        defaultState = sid;
        break;
      }
    }

    // Generate variant for each NON-default state
    for (const sid of stateIds) {
      if (sid === defaultState) {
        console.log(`  Skipping default state "${sid}" for ${baseName} (already has PNG)`);
        continue;
      }

      const variantHtml = createStateVariant(html, sid);
      const variantFile = `${baseName}_${sid}.html`;
      writeHtml(join(OUT_DIR, variantFile), variantHtml);
      generatedVariants.push({
        html: variantFile,
        png: `${baseName}_${sid}.png`,
        screen: baseName,
        state: sid,
        type: 'state_variant'
      });
    }
  }

  // ── Custom interactive states ──

  console.log('\n=== Generating custom interactive states ===\n');

  // 1. Add Transaction - Dropdown open
  const addTxHtml = readHtml(join(GOLDEN_DIR, 'add_transaction_screen_spec.html'));
  const dropdownHtml = generateDropdownOpen('add_transaction', addTxHtml);
  writeHtml(join(OUT_DIR, 'add_transaction_screen_spec_dropdown_open.html'), dropdownHtml);
  generatedVariants.push({
    html: 'add_transaction_screen_spec_dropdown_open.html',
    png: 'add_transaction_screen_spec_dropdown_open.png',
    screen: 'add_transaction_screen_spec',
    state: 'dropdown_open',
    type: 'interactive'
  });

  // 2. Add Transaction - Date picker open
  const datePickerHtml = generateDatePickerOpen('add_transaction', addTxHtml);
  writeHtml(join(OUT_DIR, 'add_transaction_screen_spec_datepicker_open.html'), datePickerHtml);
  generatedVariants.push({
    html: 'add_transaction_screen_spec_datepicker_open.html',
    png: 'add_transaction_screen_spec_datepicker_open.png',
    screen: 'add_transaction_screen_spec',
    state: 'datepicker_open',
    type: 'interactive'
  });

  // 3. Settings - Dark mode ON
  const settingsHtml = readHtml(join(GOLDEN_DIR, 'settings_screen_spec.html'));
  const settingsDarkHtml = generateSettingsDarkModeOn(settingsHtml);
  writeHtml(join(OUT_DIR, 'settings_screen_spec_dark_on.html'), settingsDarkHtml);
  generatedVariants.push({
    html: 'settings_screen_spec_dark_on.html',
    png: 'settings_screen_spec_dark_on.png',
    screen: 'settings_screen_spec',
    state: 'dark_on',
    type: 'interactive'
  });

  // 4. Security Settings - Biometric ON
  const securityHtml = readHtml(join(GOLDEN_DIR, 'security_settings_screen_spec.html'));
  const securityBioHtml = generateSecurityBiometricOn(securityHtml);
  writeHtml(join(OUT_DIR, 'security_settings_screen_spec_biometric_on.html'), securityBioHtml);
  generatedVariants.push({
    html: 'security_settings_screen_spec_biometric_on.html',
    png: 'security_settings_screen_spec_biometric_on.png',
    screen: 'security_settings_screen_spec',
    state: 'biometric_on',
    type: 'interactive'
  });

  // 5. Theme Customizer - Dark mode ON
  const themeHtml = readHtml(join(GOLDEN_DIR, 'theme_customizer_screen_spec.html'));
  const themeDarkHtml = generateThemeDarkModeOn(themeHtml);
  writeHtml(join(OUT_DIR, 'theme_customizer_screen_spec_dark_on.html'), themeDarkHtml);
  generatedVariants.push({
    html: 'theme_customizer_screen_spec_dark_on.html',
    png: 'theme_customizer_screen_spec_dark_on.png',
    screen: 'theme_customizer_screen_spec',
    state: 'dark_on',
    type: 'interactive'
  });

  // 6. Nav tab variants - Bills, Assets, Settings active
  const navHtml = readHtml(join(GOLDEN_DIR, 'floating_bottom_nav_spec.html'));
  for (const idx of [1, 2, 3]) {
    const labels = ['Record', 'Bills', 'Assets', 'Settings'];
    const navVariantHtml = generateNavVariant(navHtml, idx);
    const navFile = `floating_bottom_nav_spec_tab_${labels[idx].toLowerCase()}.html`;
    writeHtml(join(OUT_DIR, navFile), navVariantHtml);
    generatedVariants.push({
      html: navFile,
      png: `floating_bottom_nav_spec_tab_${labels[idx].toLowerCase()}.png`,
      screen: 'floating_bottom_nav_spec',
      state: `tab_${labels[idx].toLowerCase()}`,
      type: 'interactive'
    });
  }

  // ── Summary ──
  console.log(`\n=== Generated ${generatedVariants.length} variant HTML files ===\n`);
  for (const v of generatedVariants) {
    console.log(`  ${v.png}`);
  }

  // Write a JSON manifest for the screenshot runner
  const manifest = generatedVariants.map(v => ({
    html: join(GOLDEN_DIR, v.html),
    png: join(GOLDEN_DIR, v.png),
    state: v.state,
    screen: v.screen,
    type: v.type
  }));

  writeFileSync(join(GOLDEN_DIR, '_variant_manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
  console.log('\nWrote _variant_manifest.json');
}

main();
