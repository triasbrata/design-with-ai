/** Browser-compatible design review tool definitions (fetches data from the dev server). */

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

async function fetchMetadata(): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch('/screens/screen-metadata.json');
    return await res.json();
  } catch {
    return null;
  }
}

/** Execute a design review tool in the browser. */
export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<{ content: { type: string; text: string }[] }> {
  switch (name) {
    case 'designReview_listScreens': {
      const meta = await fetchMetadata();
      if (!meta) {
        return { content: [{ type: 'text', text: 'No metadata found' }] };
      }
      const screens = (meta as Record<string, any>).screens || {};
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ screens: Object.keys(screens), metadata: screens }, null, 2),
          },
        ],
      };
    }
    case 'designReview_getScreenMeta': {
      const screen = String(args.screen || '');
      if (!screen) {
        return { content: [{ type: 'text', text: 'Error: "screen" parameter is required' }] };
      }
      const meta = await fetchMetadata();
      if (!meta) {
        return { content: [{ type: 'text', text: 'No metadata found' }] };
      }
      const screens = (meta as Record<string, any>).screens || {};
      if (!screens[screen]) {
        return { content: [{ type: 'text', text: `Screen "${screen}" not found` }] };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify({ screen, metadata: screens[screen] }, null, 2) }],
      };
    }
    case 'designReview_listSpecFiles': {
      // Browser can't list filesystem — delegate to server
      const meta = await fetchMetadata();
      const count = meta
        ? Object.keys((meta as Record<string, any>).screens || {}).length
        : 0;
      return {
        content: [{ type: 'text', text: JSON.stringify({ screenCount: count, note: 'Total screens in metadata' }, null, 2) }],
      };
    }
    default:
      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
  }
}
