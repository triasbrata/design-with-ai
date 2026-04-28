#!/bin/bash
# Batch screenshot all variant HTML files
set -e

GOLDEN_DIR="/Users/triasbratayudhana/dev/moneykitty/docs/moneykitty/design/golden"
TOOL_DIR="/Users/triasbratayudhana/dev/moneykitty/tools/screenshot_device_html"

declare -a VARIANTS=(
  # State variants
  "add_transaction_screen_spec_edit.html"
  "add_transaction_screen_spec_saving.html"
  "bills_screen_spec_empty.html"
  "bills_screen_spec_loading.html"
  "bills_screen_spec_error.html"
  "record_screen_spec_empty.html"
  "record_screen_spec_loading.html"
  "record_screen_spec_error.html"
  "transaction_list_screen_spec_empty.html"
  "transaction_list_screen_spec_loading.html"
  "wizard_add_transaction_screen_spec_step2.html"
  "wizard_add_transaction_screen_spec_step3.html"
  "wizard_add_transaction_screen_spec_step4.html"
  "pocket_manager_screen_spec_empty.html"
  "pocket_manager_screen_spec_loading.html"
  "ledger_manager_screen_spec_empty.html"
  "pin_setup_screen_spec_confirm.html"
  "pin_setup_screen_spec_change.html"
  "add_category_screen_spec_edit.html"
  "add_ledger_screen_spec_edit.html"
  "add_pocket_screen_spec_edit.html"

  # Custom interactive variants
  "add_transaction_screen_spec_dropdown_open.html"
  "add_transaction_screen_spec_datepicker_open.html"
  "settings_screen_spec_dark_on.html"
  "security_settings_screen_spec_biometric_on.html"
  "theme_customizer_screen_spec_dark_on.html"
  "floating_bottom_nav_spec_tab_bills.html"
  "floating_bottom_nav_spec_tab_assets.html"
  "floating_bottom_nav_spec_tab_settings.html"
)

cd "$TOOL_DIR"

for html_file in "${VARIANTS[@]}"; do
  png_file="${html_file%.html}.png"
  echo "=== Screenshot: $html_file -> $png_file ==="
  npx tsx screenshot-v2.ts \
    --url "$GOLDEN_DIR/$html_file" \
    --width 390 --height 844 \
    --output "$GOLDEN_DIR/$png_file"
  echo ""
done

echo "=== All 29 screenshots complete ==="
