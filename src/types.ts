export interface StateContext {
  label: string;
  description: string;
  goal: string;
}

export interface ScreenMeta {
  name: string;
  tier: string;
  description: string;
  purpose: string;
  keyElements: string[];
  states: string[];
  interactions: string[];
  stateContext?: Record<string, StateContext>;
}

export interface Metadata {
  meta: { version: string; lastUpdated: string; totalScreens: number };
  screens: Record<string, ScreenMeta>;
  components: Record<string, { name: string; description: string; appearsOn: string[] }>;
}

export interface TierInfo {
  label: string;
  screens: string[];
}

export interface CaptureItem {
  screen: string;
  state: string;
  filename: string;
}

export interface CaptureResult {
  filename: string;
  ok: boolean;
  error?: string;
}
