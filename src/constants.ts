import type { TierInfo } from './types';

export type DeviceMode = "phone-v" | "phone-h" | "tablet-v" | "tablet-h" | "laptop";

export const DEVICE_PRESETS: Record<DeviceMode, { label: string; width: number; height: number; shortcut: string }> = {
  "phone-v":   { label: "Vertical",   width: 390,  height: 844,  shortcut: "⌘+1" },
  "phone-h":   { label: "Horizontal", width: 844,  height: 390,  shortcut: "⌘+2" },
  "tablet-v":  { label: "Vertical",   width: 768,  height: 1024, shortcut: "⌘+3" },
  "tablet-h":  { label: "Horizontal", width: 1024, height: 768,  shortcut: "⌘+4" },
  "laptop":    { label: "Laptop",     width: 1440, height: 900,  shortcut: "⌘+5" },
};

export const DEVICE_CYCLE: DeviceMode[] = ["phone-v", "phone-h", "tablet-v", "tablet-h", "laptop"];

export const TIERS: Record<string, TierInfo> = {
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
    screens: ['floating_bottom_nav_spec', 'user_screen_spec'],
  },
};

export function truncateName(name: string, max = 30): string {
  if (name.length <= max) return name;
  return name.slice(0, max) + "...";
}

export function screenName(filename: string): string {
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
