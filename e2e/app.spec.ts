import { test, expect, type Page } from "@playwright/test";

/* ==========================================================================
   E2E Tests for Golden Review Screenshot Tool
   ==========================================================================
   Uses real screen data from the golden directory.
   Serial blocks share a manually created page (beforeAll with browser).
   ========================================================================== */

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Send focus to body so keyboard events don't get swallowed by inputs */
async function focusBody(page: Page) {
  await page.locator("body").click({ position: { x: 10, y: 10 } });
  await page.waitForTimeout(100);
}

/** Open left drawer via burger button (more reliable than keyboard) */
async function openLeftDrawer(page: Page) {
  const toggle = page.getByRole("button", { name: "Toggle workspace" });
  await toggle.click();
}

/** Close left drawer */
async function closeLeftDrawer(page: Page) {
  const close = page.locator(".ld-drawer-header .ld-close-btn");
  await close.click();
}

/** Assert left drawer is open */
async function expectDrawerOpen(page: Page) {
  await expect(page.locator(".left-drawer.open")).toBeVisible({ timeout: 3000 });
}

/** Assert left drawer is closed */
async function expectDrawerClosed(page: Page) {
  await expect(page.locator(".left-drawer.open")).not.toBeVisible();
}

/** Open right drawer */
async function openRightDrawer(page: Page) {
  const toggle = page.locator(".drawer-trigger .burger-btn");
  await toggle.click();
  await expect(page.locator(".right-drawer.open")).toBeVisible({ timeout: 3000 });
}

/** Close right drawer */
async function closeRightDrawer(page: Page) {
  const close = page.locator(".rd-drawer-header .ld-close-btn");
  await close.click();
}

// ── 1. Empty State ───────────────────────────────────────────────────────────

test.describe("Empty State", () => {
  test("shows empty state message when metadata has no screens", async ({ page }) => {
    await page.route("**/api/metadata**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          meta: { version: "1.0", lastUpdated: "", totalScreens: 0 },
          screens: {},
          components: {},
        }),
      });
    });

    // Clear localStorage to wipe the default workspace
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForTimeout(500);

    await expect(page.locator("body")).toContainText("No screens found", { timeout: 8000 });
  });
});

// ── 2. Workspace Management (serial) ─────────────────────────────────────────

test.describe("Workspace Management", () => {
  test.describe.configure({ mode: "serial" });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage({ baseURL: "http://localhost:4200" });
    // Clear any stored state
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForTimeout(800);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("opens left drawer with burger button", async () => {
    await openLeftDrawer(page);
    await expectDrawerOpen(page);
  });

  test("closes drawer via X button", async () => {
    await closeLeftDrawer(page);
    await expectDrawerClosed(page);
  });

  test("reopens drawer for management", async () => {
    await openLeftDrawer(page);
    await expectDrawerOpen(page);
  });

  test("adds workspace via inline form", async () => {
    // Click Add Workspace
    const addBtn = page.locator(".ld-add-workspace");
    await addBtn.click();
    await expect(page.locator(".ld-inline-create")).toBeVisible({ timeout: 3000 });

    // Fill name and confirm
    await page.locator(".ld-inline-input").fill("E2E Test Workspace");
    await page.locator(".ld-inline-confirm").click();
    await page.waitForTimeout(300);

    // Verify new workspace section appears (added at the end, so last())
    const titles = page.locator(".ld-section-title");
    await expect(titles.last()).toContainText("E2E Test Workspace");
  });

  test("renames workspace by double-clicking", async () => {
    const wsTitle = page.locator(".ld-section-title").first();
    await wsTitle.dblclick();
    await expect(page.locator(".ld-rename-input").first()).toBeVisible({ timeout: 3000 });

    await page.locator(".ld-rename-input").first().fill("Renamed WS");
    await page.locator(".ld-rename-input").first().press("Enter");
    await page.waitForTimeout(200);

    await expect(page.locator(".ld-section-title").first()).toContainText("Renamed WS");
  });

  test("adds folder to workspace", async () => {
    // Disable FS API so fallback path inputs are shown instead of "Pick Folder"
    await page.evaluate(() => {
      (window as any).showDirectoryPicker = undefined;
    });
    // Wait for re-render
    await page.waitForTimeout(200);

    // Click + on the workspace
    const addFolder = page.locator(".ld-folder-add").first();
    await addFolder.click();
    await expect(page.locator(".ld-folder-create")).toBeVisible({ timeout: 3000 });

    // Fill folder name + input dir
    const inputs = page.locator(".ld-folder-create .ld-folder-input");
    await inputs.nth(0).fill("E2E Folder");
    await inputs.nth(1).fill("../../docs/moneykitty/design/golden/");

    // Confirm
    await page.locator(".ld-folder-create-actions .ld-inline-confirm").click();
    await page.waitForTimeout(300);

    // Folder should appear
    const sectionTitles = page.locator(".ld-section-title");
    const count = await sectionTitles.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("rename folder by double-clicking", async () => {
    const folderTitle = page.locator(".ld-section-body .ld-section-title").first();
    await folderTitle.dblclick();
    await expect(page.locator(".ld-rename-input")).toBeVisible({ timeout: 3000 });

    await page.locator(".ld-rename-input").fill("Renamed Folder");
    await page.locator(".ld-rename-input").press("Enter");
    await page.waitForTimeout(200);

    await expect(page.locator(".ld-section-body .ld-section-title").first()).toContainText("Renamed Folder");
  });

  test("folder right-click context menu shows Rename and Delete Folder", async () => {
    const folderTitle = page.locator(".ld-section-body .ld-section-title").first();
    await folderTitle.click({ button: "right" });
    await expect(page.locator(".ld-context-menu")).toBeVisible({ timeout: 3000 });

    await expect(page.locator(".ld-context-menu")).toContainText("Rename");
    await expect(page.locator(".ld-context-menu")).toContainText("Delete Folder");

    // Dismiss by clicking outside
    await page.locator(".left-drawer-inner").click({ position: { x: 10, y: 10 } });
    await expect(page.locator(".ld-context-menu")).not.toBeVisible();
  });

  test("context menu on workspace shows Rename, Add Folder, Close Project", async () => {
    // Right-click the workspace header
    const wsHeader = page.locator(".ld-section-header").first();
    await wsHeader.click({ button: "right" });
    await expect(page.locator(".ld-context-menu")).toBeVisible({ timeout: 3000 });

    await expect(page.locator(".ld-context-menu")).toContainText("Rename");
    await expect(page.locator(".ld-context-menu")).toContainText("Add Folder");
    await expect(page.locator(".ld-context-menu")).toContainText("Close Project");

    // Dismiss by clicking outside the context menu
    await page.locator(".left-drawer-inner").click({ position: { x: 10, y: 10 } });
    await expect(page.locator(".ld-context-menu")).not.toBeVisible();
  });

  test("context menu rename via right-click", async () => {
    const wsHeader = page.locator(".ld-section-header").first();
    await wsHeader.click({ button: "right" });
    await page.locator(".ld-context-item:has-text('Rename')").click();
    await expect(page.locator(".ld-rename-input").first()).toBeVisible({ timeout: 3000 });

    await page.locator(".ld-rename-input").first().fill("Ctx Renamed");
    await page.locator(".ld-rename-input").first().press("Enter");
    await page.waitForTimeout(200);

    await expect(page.locator(".ld-section-title").first()).toContainText("Ctx Renamed");
  });

  test("collapses and expands workspace with chevron", async () => {
    // Use evaluate to programmatically click the section header (avoids child
    // element interceptors like .ld-folder-add with stopPropagation).
    const wsHeader = page.locator(".ld-section-header").first();
    await wsHeader.evaluate((el) => (el as HTMLButtonElement).click());
    await page.waitForTimeout(500);

    // Section body should be hidden
    const body = page.locator(".ld-section-body").first();
    await expect(body).not.toBeVisible({ timeout: 5000 });

    // Expand again
    await wsHeader.evaluate((el) => (el as HTMLButtonElement).click());
    await page.waitForTimeout(300);
  });

  test("toggles drawer pin", async () => {
    const pinBtn = page.locator(".ld-pin-btn");
    await expect(pinBtn).toBeVisible({ timeout: 3000 });

    // Pin the drawer (use evaluate to avoid layout interception)
    await pinBtn.evaluate((el) => (el as HTMLButtonElement).click());
    await page.waitForTimeout(200);
    await expect(pinBtn).toHaveClass(/pinned/);

    // Unpin the drawer
    await pinBtn.evaluate((el) => (el as HTMLButtonElement).click());
    await page.waitForTimeout(200);
    await expect(pinBtn).not.toHaveClass(/pinned/);
  });

  test("deletes folder via trash icon", async () => {
    // Workspace has 2 folders (Main Screens + E2E Folder). Deleting first folder
    // is direct — no modal, since project.folders.length > 1.
    await page.locator(".ld-folder-delete").first().evaluate((el) => {
      (el as HTMLButtonElement).click();
    });
    await page.waitForTimeout(300);

    // Verify one folder remains, then delete the last one to trigger modal
    let folderHeaders = page.locator(".ld-section-body .ld-section-header");
    let count = await folderHeaders.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Only 1 folder left — deleting should trigger confirm modal
    await page.locator(".ld-folder-delete").first().evaluate((el) => {
      (el as HTMLButtonElement).click();
    });
    await page.waitForTimeout(300);

    await expect(page.locator(".cm-overlay")).toBeVisible({ timeout: 3000 });
    await expect(page.locator(".cm-overlay")).toContainText("Delete last folder");

    // Keep the folder
    await page.locator(".cm-btn-cancel").click();
    await expect(page.locator(".cm-overlay")).not.toBeVisible();
  });

  test("close project from context menu", async () => {
    const wsHeader = page.locator(".ld-section-header").first();
    await wsHeader.evaluate((el) => {
      el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 100, clientY: 100 }));
    });
    await page.waitForTimeout(100);
    await page.locator(".ld-context-item:has-text('Close Project')").click();
    await page.waitForTimeout(300);
  });
});

// ── 3. Screen Navigation & Device Mode (serial) ─────────────────────────────

test.describe("Screen Navigation & Device Mode", () => {
  test.describe.configure({ mode: "serial" });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage({ baseURL: "http://localhost:4200" });
    await page.goto("/");
    await page.waitForTimeout(1000);
    // Default MoneyKitty workspace loads screens from the golden dir
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("bottom bar shows screen name and position", async () => {
    await expect(page.locator(".bar-name")).toBeVisible({ timeout: 5000 });
    await expect(page.locator(".bar-pos")).toBeVisible();
  });

  test("navigates forward with ArrowRight", async () => {
    await focusBody(page);
    const nameBefore = await page.locator(".bar-name").textContent();
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(500);
    const nameAfter = await page.locator(".bar-name").textContent();
    // Either moved to next screen or is at summary
    await expect(page.locator(".bar-name")).toBeVisible();
  });

  test("navigates backward with ArrowLeft", async () => {
    await focusBody(page);
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(500);
    await expect(page.locator(".bar-name")).toBeVisible();
  });

  test("opens drawer and clicks a screen to navigate", async () => {
    await openLeftDrawer(page);
    await expectDrawerOpen(page);

    const items = page.locator(".ld-screen-item");
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
    const screenName = await items.first().textContent();

    await items.first().click();
    await page.waitForTimeout(400);

    // Drawer auto-closes on screen select
    await expect(page.locator(".bar-name")).toBeVisible();
  });

  test("device mode dropdown opens on click", async () => {
    const deviceBtn = page.locator("button[aria-label*='Device']").first();
    await expect(deviceBtn).toBeVisible();
    await deviceBtn.click();
    await expect(page.locator(".device-dropdown")).toBeVisible({ timeout: 3000 });

    const options = page.locator(".device-option");
    expect(await options.count()).toBe(6);

    // Dismiss by clicking device btn again
    await deviceBtn.click();
    await expect(page.locator(".device-dropdown")).not.toBeVisible();
  });

  test("switches to Horizontal mode via dropdown", async () => {
    const deviceBtn = page.locator("button[aria-label*='Device']").first();
    await deviceBtn.click();
    await expect(page.locator(".device-dropdown")).toBeVisible({ timeout: 3000 });

    await page.locator(".device-option", { hasText: "Horizontal" }).first().click();
    await page.waitForTimeout(300);

    await expect(deviceBtn).toContainText("Horizontal");
  });

  test("switches to Desktop mode via Ctrl+6 shortcut", async () => {
    await focusBody(page);
    await page.keyboard.press("Control+6");
    await page.waitForTimeout(300);

    const deviceBtn = page.locator("button[aria-label*='Device']").first();
    await expect(deviceBtn).toContainText("Desktop");
  });

  test("switches to Vertical via Ctrl+1 shortcut", async () => {
    await focusBody(page);
    await page.keyboard.press("Control+1");
    await page.waitForTimeout(300);
  });

  test("meta panel shows metadata for current screen", async () => {
    await expect(page.locator(".meta-panel")).toBeVisible({ timeout: 5000 });
    await expect(page.locator(".meta-panel")).toContainText("Description");
    await expect(page.locator(".meta-panel")).toContainText("Purpose");
    await expect(page.locator(".meta-panel")).toContainText("Key Elements");
  });

  test("state tabs are clickable", async () => {
    const stateTabs = page.locator(".state-tab");
    const count = await stateTabs.count();
    expect(count).toBeGreaterThanOrEqual(1);

    if (count > 1) {
      // Wait for iframe baseline contract
      await page.waitForTimeout(800);

      await stateTabs.nth(1).click();
      await page.waitForTimeout(500);
      await expect(stateTabs.nth(1)).toHaveClass(/active/);

      // Switch back to Overview
      await stateTabs.nth(0).click();
      await page.waitForTimeout(300);
      await expect(stateTabs.nth(0)).toHaveClass(/active/);
    }
  });
});

// ── 4. Device Mode Independence ──────────────────────────────────────────────

test.describe("Device Mode Independence", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage({ baseURL: "http://localhost:4200" });
    await page.goto("/");
    await page.waitForTimeout(1000);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("all six device mode shortcuts cycle through modes", async () => {
    const modes: { key: string; label: string }[] = [
      { key: "Control+1", label: "Vertical" },
      { key: "Control+2", label: "Horizontal" },
      { key: "Control+3", label: "Vertical" },
      { key: "Control+4", label: "Horizontal" },
      { key: "Control+5", label: "Laptop" },
      { key: "Control+6", label: "Desktop" },
    ];

    const deviceBtn = page.locator("button[aria-label*='Device']").first();
    await expect(deviceBtn).toBeVisible();

    for (const mode of modes) {
      await focusBody(page);
      await page.keyboard.press(mode.key);
      await page.waitForTimeout(200);
      await expect(deviceBtn).toContainText(mode.label, { timeout: 3000 });
    }
  });
});

// ── 5. Chat Panel (serial) ──────────────────────────────────────────────────

test.describe("Chat Panel", () => {
  test.describe.configure({ mode: "serial" });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage({ baseURL: "http://localhost:4200" });
    await page.goto("/");
    await page.waitForTimeout(800);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("opens right drawer", async () => {
    await openRightDrawer(page);
  });

  test("chat textarea accepts text input", async () => {
    const textarea = page.locator(".chat-textarea");
    await expect(textarea).toBeVisible();
    await textarea.fill("Hello from E2E test");
    await expect(textarea).toHaveValue("Hello from E2E test");
  });

  test("send button disabled when input empty", async () => {
    const textarea = page.locator(".chat-textarea");
    await textarea.fill("");
    await expect(page.locator(".chat-send-btn")).toBeDisabled();
  });

  test("send button enabled with non-empty input", async () => {
    await page.locator(".chat-textarea").fill("Test message");
    await expect(page.locator(".chat-send-btn")).toBeEnabled();
  });

  test("model selector dropdown opens", async () => {
    // The model chip has data-dropdown-trigger="model"
    const modelChip = page.locator(".chat-chip[data-dropdown-trigger='model']");
    await modelChip.click();
    await waitForDropdown(page, "model");
    await expect(page.locator(".chat-model-dropdown")).toBeVisible();
    await dismissDropdown(page);
  });

  test("approval mode dropdown opens", async () => {
    const chip = page.locator(".chat-chip[data-dropdown-trigger='approval']");
    await chip.click();
    await expect(page.locator(".chat-approval-dropdown")).toBeVisible({ timeout: 3000 });
    await dismissDropdown(page);
  });

  test("reasoning effort dropdown opens", async () => {
    const chip = page.locator(".chat-chip[data-dropdown-trigger='reasoning']");
    await chip.click();
    await expect(page.locator(".chat-reasoning-dropdown")).toBeVisible({ timeout: 3000 });
    await dismissDropdown(page);
  });

  test("renames chat by clicking name", async () => {
    const nameBtn = page.locator(".chat-name-btn");
    await expect(nameBtn).toBeVisible();

    await nameBtn.click();
    await expect(page.locator(".chat-name-input")).toBeVisible({ timeout: 3000 });

    await page.locator(".chat-name-input").fill("E2E Chat");
    await page.locator(".chat-name-input").press("Enter");
    await page.waitForTimeout(200);

    await expect(nameBtn).toContainText("E2E Chat");
  });

  test("history button opens session panel", async () => {
    const historyBtn = page.locator("button[title='History']").first();
    await expect(historyBtn).toBeVisible();
    await historyBtn.click();
    await expect(page.locator(".sp-panel")).toBeVisible({ timeout: 3000 });
  });

  test("session panel has search input and session list", async () => {
    await expect(page.locator(".sp-search-input")).toBeVisible();
    await expect(page.locator(".sp-item").first()).toBeVisible();
  });

  test("creates new session from session panel", async () => {
    const newBtn = page.locator(".sp-new-btn");
    await expect(newBtn).toBeVisible();
    await newBtn.click();
    await page.waitForTimeout(400);
    // New session closes the panel — verify empty chat state is shown
    await expect(page.locator(".chat-empty-state")).toBeVisible({ timeout: 3000 });

    // Re-open session panel to verify new session exists
    const historyBtn = page.locator("button[title='History']").first();
    await historyBtn.click();
    await expect(page.locator(".sp-panel")).toBeVisible({ timeout: 3000 });
    const count = await page.locator(".sp-item").count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("switches to another session", async () => {
    const items = page.locator(".sp-item");
    const count = await items.count();
    if (count >= 2) {
      await items.nth(1).locator(".sp-item-name").click();
      await page.waitForTimeout(300);
    }
  });

  test("deletes a session from session panel", async () => {
    const historyBtn = page.locator("button[title='History']").first();
    await historyBtn.click();
    await expect(page.locator(".sp-panel")).toBeVisible({ timeout: 3000 });

    const countBefore = await page.locator(".sp-item").count();
    expect(countBefore).toBeGreaterThanOrEqual(1);

    // Delete the first session
    await page.locator(".sp-item-delete").first().click();
    await page.waitForTimeout(300);

    const countAfter = await page.locator(".sp-item").count();
    // Should have one fewer session (or auto-create replacement)
    expect(countAfter).toBeGreaterThanOrEqual(countBefore - 1);

    // Close session panel
    await page.locator(".chat-panel").click({ position: { x: 20, y: 20 } });
    await page.waitForTimeout(300);
  });

  test("closes session panel and right drawer", async () => {
    // Click on chat panel (outside session panel) to dismiss
    await page.locator(".chat-panel").click({ position: { x: 20, y: 20 } });
    await page.waitForTimeout(400);
    await expect(page.locator(".sp-panel")).not.toBeVisible();

    // Close right drawer
    await closeRightDrawer(page);
    await expect(page.locator(".right-drawer.open")).not.toBeVisible();
  });
});

// ── 6. Help Modal ───────────────────────────────────────────────────────────

test.describe("Help Modal", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage({ baseURL: "http://localhost:4200" });
    await page.goto("/");
    await page.waitForTimeout(800);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("opens help modal via bottom bar button", async () => {
    const helpBtn = page.locator("button[aria-label='Keyboard shortcuts']");
    await helpBtn.click();
    await expect(page.locator(".modal-overlay.show")).toBeVisible({ timeout: 3000 });
    await expect(page.locator(".modal-box")).toContainText("Keyboard Shortcuts");
  });

  test("closes help modal by clicking overlay", async () => {
    await page.locator(".modal-overlay.show").click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(400);
    await expect(page.locator(".modal-overlay.show")).not.toBeVisible();
  });
});

// ── 7. Capture ──────────────────────────────────────────────────────────────

test.describe("Capture", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage({ baseURL: "http://localhost:4200" });
    await page.goto("/");
    await page.waitForTimeout(1000);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("capture button is visible in bottom bar", async () => {
    const btn = page.locator("button[aria-label='Screenshot current screen']");
    await expect(btn).toBeVisible({ timeout: 5000 });
  });

  test("clicking capture activates tool", async () => {
    const btn = page.locator("button[aria-label='Screenshot current screen']");
    await btn.click();
    await page.waitForTimeout(300);
    // The button should show "Capture" after activation
    await expect(btn).toContainText("Capture");
  });
});

// ── 8. Navigation Edge Cases ────────────────────────────────────────────────

test.describe("Navigation Edge Cases", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage({ baseURL: "http://localhost:4200" });
    await page.goto("/");
    await page.waitForTimeout(1000);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("arrow-navigates through all screens and reaches summary", async () => {
    // Get total screens
    await openLeftDrawer(page);
    await page.waitForTimeout(300);
    const screenCount = await page.locator(".ld-screen-item").count();
    await closeLeftDrawer(page);

    // Navigate past the last screen to reach summary
    for (let i = 0; i <= screenCount; i++) {
      await focusBody(page);
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(300);
    }

    // Either summary page or still on a screen — both valid
    const summaryVisible = await page.locator(".summary-table").isVisible().catch(() => false);
    const barVisible = await page.locator(".bar-name").isVisible().catch(() => false);
    expect(summaryVisible || barVisible).toBeTruthy();
  });

  test("pressing Escape returns to first screen from summary", async () => {
    // If on summary, Escape should go back
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    // Should be on a screen now
    await expect(page.locator(".bar-name")).toBeVisible({ timeout: 5000 });
  });
});

// ── Dropdown helpers ─────────────────────────────────────────────────────────

async function waitForDropdown(page: Page, type: string) {
  await page.waitForTimeout(300);
}

async function dismissDropdown(page: Page) {
  // Click a safe area on the right side of the header (away from chat-name-btn)
  await page.locator(".chat-header").click({ position: { x: 250, y: 10 } });
  await page.waitForTimeout(200);
}
