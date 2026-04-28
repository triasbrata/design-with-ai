import path from 'node:path';
import fs from 'node:fs';

const GOLDEN_DIR = path.resolve(
  process.env.GOLDEN_DIR || path.join(process.cwd(), '../../docs/moneykitty/design/golden')
);

/** Load screen metadata from the golden directory. */
function loadMetadata(): Record<string, unknown> | null {
  try {
    const p = path.join(GOLDEN_DIR, 'screen-metadata.json');
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

/** List all screens with their tier metadata. */
export function listScreens(): Record<string, unknown> {
  const meta = loadMetadata();
  if (!meta) return { screens: [], error: 'No metadata found' };
  const screens = meta as { screens?: Record<string, unknown> };
  return {
    screens: Object.keys(screens.screens || {}),
    metadata: screens.screens,
  };
}

/** Get metadata for a single screen. */
export function getScreenMeta(screen: string): Record<string, unknown> {
  const meta = loadMetadata();
  if (!meta) return { error: 'No metadata found' };
  const screens = (meta as Record<string, any>).screens || {};
  if (!screens[screen]) return { error: `Screen "${screen}" not found` };
  return { screen, metadata: screens[screen] };
}

/** Get the path to a screen's spec file. */
export function getScreenPath(screen: string): string {
  return path.join(GOLDEN_DIR, `${screen}_spec.html`);
}

/** Check if a screen spec file exists. */
export function screenExists(screen: string): boolean {
  return fs.existsSync(getScreenPath(screen));
}

/** List all available HTML spec files in the golden directory. */
export function listSpecFiles(): string[] {
  try {
    return fs.readdirSync(GOLDEN_DIR).filter((f) => f.endsWith('_spec.html'));
  } catch {
    return [];
  }
}

/** Tool definitions for design review operations. */
export const toolDefinitions = [
  {
    name: 'designReview_listScreens',
    description: 'List all design review screens with their metadata',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'designReview_getScreenMeta',
    description: 'Get metadata for a specific design screen',
    inputSchema: {
      type: 'object',
      properties: {
        screen: { type: 'string', description: 'Screen name (without _spec.html suffix)' },
      },
      required: ['screen'],
    },
  },
  {
    name: 'designReview_listSpecFiles',
    description: 'List all available HTML spec files in the golden directory',
    inputSchema: { type: 'object', properties: {} },
  },
];

/** Execute a design review tool by name. */
export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<{ content: { type: string; text: string }[] }> {
  switch (name) {
    case 'designReview_listScreens': {
      const result = listScreens();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'designReview_getScreenMeta': {
      const screen = String(args.screen || '');
      if (!screen) {
        return { content: [{ type: 'text', text: 'Error: "screen" parameter is required' }] };
      }
      const result = getScreenMeta(screen);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    case 'designReview_listSpecFiles': {
      const files = listSpecFiles();
      return { content: [{ type: 'text', text: JSON.stringify(files, null, 2) }] };
    }
    default:
      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
  }
}
