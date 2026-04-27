# HTML Baseline Spec — MoneyKitty Design Review Tool

UX agent MUST follow this contract so the design review tool can:
- Programmatically switch states from the viewer
- Capture screenshots per state automatically
- Display correct state context

## 1. File Convention

| Rule | Example |
|------|---------|
| Naming | `{screen}_spec.html` — `record_screen_spec.html` |
| Location | `docs/moneykitty/design/golden/` |
| States | embedded in single HTML file, toggled via CSS classes |

## 2. Required JS API

Every baseline HTML MUST include this script at the end of `<body>`:

```html
<script>
// Standard state controller for design review tool
window.__baseline = {
  currentState: 'default',
  states: ['default', 'empty', 'loading', 'error'], // list ALL states
  setState: function(name) {
    // Hide all state containers
    document.querySelectorAll('[data-baseline-state]').forEach(el => {
      el.style.display = 'none';
    });
    // Show selected state
    const target = document.querySelector('[data-baseline-state="' + name + '"]');
    if (target) {
      target.style.display = '';
      this.currentState = name;
    }
    // Update active button
    document.querySelectorAll('.state-toggle').forEach(b => {
      b.classList.toggle('active', b.dataset.state === name);
    });
  }
};

// Listen for parent viewer commands (postMessage)
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'setState' && e.data.state) {
    window.__baseline.setState(e.data.state);
  }
});
</script>
```

## 3. Required HTML Structure

Each state MUST be wrapped in a container with `data-baseline-state` attribute:

```html
<!-- Default state (visible on load) -->
<div data-baseline-state="default">
  <!-- all default content -->
</div>

<!-- Empty state (hidden by default via inline style or CSS) -->
<div data-baseline-state="empty" style="display:none">
  <!-- empty state content -->
</div>

<!-- Loading state -->
<div data-baseline-state="loading" style="display:none">
  <!-- loading skeleton -->
</div>

<!-- Error state -->
<div data-baseline-state="error" style="display:none">
  <!-- error content -->
</div>
```

## 4. State Toggle Buttons (Optional, for standalone viewing)

State toggle buttons for manual testing. Use class `state-toggle` and `data-state`:

```html
<div class="baseline-controls" style="position:fixed;top:8px;right:8px;z-index:999;display:flex;gap:4px">
  <button class="state-toggle active" data-state="default" onclick="__baseline.setState('default')">Data</button>
  <button class="state-toggle" data-state="empty" onclick="__baseline.setState('empty')">Empty</button>
  <button class="state-toggle" data-state="loading" onclick="__baseline.setState('loading')">Loading</button>
</div>
```

CSS for toggle buttons:
```css
.state-toggle {
  padding: 3px 10px; border-radius: 10px; border: 1px solid #ccc;
  background: #fff; font-size: 11px; cursor: pointer; font-family: Nunito, sans-serif;
}
.state-toggle.active { background: #C45353; color: #fff; border-color: #C45353; }
```

## 5. State Naming Convention

State names in HTML `data-baseline-state` MUST match the `states` array in `screen-metadata.json`:

| Standard State | `data-baseline-state` value | Use case |
|---------------|---------------------------|----------|
| Default/Data | `default` | Normal state with data populated |
| Empty | `empty` | No data, empty state widget |
| Loading | `loading` | Skeleton/shimmer loading |
| Error | `error` | Error message with retry |
| Add/Create | `add` | Form in create mode |
| Edit | `edit` | Form in edit mode |
| Saving | `saving` | Form submitting |
| Confirm | `confirm` | PIN confirm step |
| Step N | `step1` … `step4` | Wizard steps |

For screens with custom states (e.g., dark theme toggle), use descriptive names: `dark_on`, `biometric_on`, `tab_record`, etc.

## 6. Phone Frame

All baselines should be designed for **390×844px** viewport. The iframe enforces this size. Content outside this viewport will be cropped.

Use this viewport meta:
```html
<meta name="viewport" content="width=390, initial-scale=1.0, user-scalable=no">
```

## 7. Design Tokens

All colors MUST use exact hex values from `lib/core/design/tokens.dart`:
- `bgPage`: `#FEF6E9`
- `bgSurface`: `#FDFBF7`
- `accentRed`: `#C45353`
- `textPrimary`: `#2B2B2B`
- `textSecondary`: `#8A8075`
- Font: Nunito (Google Fonts)

## 8. Validation Checklist

Before submitting a baseline HTML, UX agent MUST verify:
- [ ] `window.__baseline` object defined with `setState()` function
- [ ] All states wrapped in `[data-baseline-state]` containers
- [ ] State names match `screen-metadata.json` states array
- [ ] `postMessage` listener registered
- [ ] Viewport meta set to 390×844
- [ ] Design tokens match `tokens.dart` hex values
- [ ] Toggle buttons use class `state-toggle` and `data-state`
- [ ] Default state visible on load, all others `display:none`
