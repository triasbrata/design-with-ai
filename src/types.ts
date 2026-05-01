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

export interface CaptureFolder {
  name: string;
  inputDir: string;
  outputDir: string;
  inputHandleId?: string;
  outputHandleId?: string;
  /** Relative path segments from root handle to golden dir (FS API mode) */
  handlePath?: string[];
}

export interface Workspace {
  type: "workspace";
  name: string;
  folders: CaptureFolder[];
  activeFolder: number;
}

export type Project = Workspace;

// ── Marker types ──

export interface MarkerRect {
  x: number;     // px, relative to iframe content (390×844)
  y: number;
  width: number;
  height: number;
}

export interface MarkedElement {
  tag: string;
  text: string;
  selector: string;
  boundingBox: MarkerRect;
  caiId?: string;  // context AI identifier from cai-id attribute
}

export interface MarkerContext {
  id?: string;
  screen: string;
  state: string;
  rect: MarkerRect;
  elementPath?: string[];
  text?: string;
  html?: string;
  parentText?: string;
  element: MarkedElement | null;  // null until extracted from iframe
  timestamp?: number;
}

export interface Marker extends MarkerContext {
  color: string;
}
