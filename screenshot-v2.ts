#!/usr/bin/env node

/**
 * MoneyKitty golden screenshot tool v2
 *
 * Screenshots HTML spec files with device emulation.
 * Supports JSON config, multiple browser channels, and persistent browser contexts.
 *
 * Usage:
 *   npx tsx screenshot-v2.ts --config config.json
 *   npx tsx screenshot-v2.ts --json '{"url":"./spec.html","width":390,"height":844,"output":"out.png"}'
 *   npx tsx screenshot-v2.ts --url ./spec.html --width 390 --height 844 --output out.png
 *   echo '{"url":"./spec.html","width":390}' | npx tsx screenshot-v2.ts --json -
 */

import { chromium, Browser, BrowserContext } from 'playwright';
import { createServer, Server, IncomingMessage, ServerResponse } from 'http';
import { readFileSync, statSync } from 'fs';
import { extname, resolve, basename, dirname, join, sep } from 'path';
import { AddressInfo } from 'net';

// ─── Types ────────────────────────────────────────────────────────────────────

export type WaitUntil = 'load' | 'domcontentloaded' | 'networkidle' | 'commit';

export interface ScreenshotConfig {
  url: string;
  width: number;
  height: number;
  output?: string;
  useExistingBrowser?: boolean;
  fullPage?: boolean;
  deviceScaleFactor?: number;
  waitUntil?: WaitUntil;
  browser?: 'chrome' | 'chromium';
}

export interface CliFlags {
  config?: string;
  json?: string;
  url?: string;
  width?: number;
  height?: number;
  output?: string;
  browser?: 'chrome' | 'chromium';
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const USER_DATA_DIR = join(
  process.env.HOME || '/tmp',
  'Library', 'Application Support', 'Google', 'Chrome'
);

export const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

export const DEFAULTS: ScreenshotConfig = {
  url: '',
  width: 390,
  height: 844,
  useExistingBrowser: false,
  fullPage: false,
  deviceScaleFactor: 2,
  waitUntil: 'networkidle',
  browser: 'chromium',
};

// ─── Config parsing ───────────────────────────────────────────────────────────

export function defaultOutputName(url: string, width: number, height: number): string {
  const name = basename(url, extname(url));
  return `${name}_${width}x${height}.png`;
}

export function parseArgs(argv: string[]): CliFlags {
  const flags: CliFlags = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--config':
        flags.config = argv[++i];
        break;
      case '--json':
        flags.json = argv[++i];
        break;
      case '--url':
        flags.url = argv[++i];
        break;
      case '--width':
        flags.width = parseInt(argv[++i], 10);
        break;
      case '--height':
        flags.height = parseInt(argv[++i], 10);
        break;
      case '--output':
        flags.output = argv[++i];
        break;
      case '--browser':
        flags.browser = argv[++i] as 'chrome' | 'chromium';
        break;
    }
  }
  return flags;
}

export function readJsonFromStdin(): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
    process.stdin.on('end', () => resolvePromise(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', reject);
  });
}

export function readJsonConfig(source: string): ScreenshotConfig {
  const raw = readFileSync(resolve(source), 'utf-8');
  return JSON.parse(raw) as ScreenshotConfig;
}

export function mergeConfig(
  flags: CliFlags,
  fileConfig?: ScreenshotConfig,
  jsonConfig?: ScreenshotConfig,
): ScreenshotConfig {
  const result: ScreenshotConfig = { ...DEFAULTS };

  // Apply file config on top of defaults
  if (fileConfig) {
    Object.assign(result, fileConfig);
  }

  // Apply inline JSON on top of file config
  if (jsonConfig) {
    Object.assign(result, jsonConfig);
  }

  // Apply quick-mode flags on top (highest priority)
  if (flags.url !== undefined) result.url = flags.url;
  if (flags.width !== undefined) result.width = flags.width;
  if (flags.height !== undefined) result.height = flags.height;
  if (flags.output !== undefined) result.output = flags.output;
  if (flags.browser !== undefined) result.browser = flags.browser;

  // Compute default output if not set
  if (!result.output) {
    result.output = defaultOutputName(result.url, result.width, result.height);
  }

  return result;
}

// ─── File server ──────────────────────────────────────────────────────────────

function serveFile(res: ServerResponse, filePath: string): void {
  const ext = extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  try {
    const body = readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

export function createFileServer(filePath: string): Promise<{ url: string; server: Server }> {
  return new Promise((resolvePromise, reject) => {
    try {
      const absPath = resolve(filePath);
      try {
        if (!statSync(absPath).isFile()) {
          reject(new Error(`Not a file: ${absPath}`));
          return;
        }
      } catch (statErr: unknown) {
        reject(new Error(`File not found: ${absPath}`));
        return;
      }

      const dir = dirname(absPath);
      const fileName = basename(absPath);

      const server = createServer((req: IncomingMessage, res: ServerResponse) => {
        const reqPath = req.url || '/';

        // Serve the main file on root or explicit name
        if (reqPath === '/' || reqPath === `/${fileName}`) {
          serveFile(res, absPath);
          return;
        }

        // Try to serve other files from the same directory
        // Remove leading slash and resolve relative to the target file's dir
        const relativePath = reqPath.startsWith('/') ? reqPath.slice(1) : reqPath;
        const requestedFile = join(dir, relativePath);

        // Security: ensure resolved path is still within the served directory
        const resolvedFile = resolve(requestedFile);
        if (!resolvedFile.startsWith(resolve(dir) + sep)) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }

        serveFile(res, resolvedFile);
      });

      server.listen(0, () => {
        const addr = server.address() as AddressInfo;
        resolvePromise({
          url: `http://localhost:${addr.port}/${fileName}`,
          server,
        });
      });
    } catch (e) {
      reject(e);
    }
  });
}

// ─── Browser helpers ──────────────────────────────────────────────────────────

export async function createPage(config: ScreenshotConfig): Promise<{
  page: import('playwright').Page;
  cleanup: () => Promise<void>;
}> {
  if (config.useExistingBrowser) {
    // Use persistent context with live Chrome user profile (can access auth)
    const context: BrowserContext = await chromium.launchPersistentContext(
      USER_DATA_DIR,
      {
        channel: 'chrome',
        headless: false,
        viewport: { width: config.width, height: config.height },
        deviceScaleFactor: config.deviceScaleFactor,
      },
    );
    const page = await context.newPage();
    return { page, cleanup: () => context.close() };
  }

  // Default headless chromium or channel chrome without profile
  const browser: Browser = await (config.browser === 'chrome'
    ? chromium.launch({ channel: 'chrome' })
    : chromium.launch());
  const context = await browser.newContext({
    viewport: { width: config.width, height: config.height },
    deviceScaleFactor: config.deviceScaleFactor,
  });
  const page = await context.newPage();
  return { page, cleanup: () => browser.close() };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function main(): Promise<void> {
  const flags = parseArgs(process.argv);
  let fileConfig: ScreenshotConfig | undefined;
  let jsonConfig: ScreenshotConfig | undefined;

  // Load config file
  if (flags.config) {
    fileConfig = readJsonConfig(flags.config);
  }

  // Load --json (inline string or '-' for stdin)
  if (flags.json) {
    const raw = flags.json === '-'
      ? await readJsonFromStdin()
      : flags.json;
    jsonConfig = JSON.parse(raw) as ScreenshotConfig;
  }

  // Inject PATH_URL env var as implicit --url (v1 compat)
  if (!flags.url && process.env.PATH_URL) {
    flags.url = process.env.PATH_URL;
  }

  const config = mergeConfig(flags, fileConfig, jsonConfig);

  if (!config.url) {
    console.error('URL or file path required. Use --url, --config, or --json.');
    process.exit(1);
  }

  // Determine URL: serve local file via HTTP if it's not a remote URL
  let url: string;
  let server: Server | null = null;

  if (config.url.startsWith('http://') || config.url.startsWith('https://')) {
    url = config.url;
  } else {
    const result = await createFileServer(config.url);
    url = result.url;
    server = result.server;
  }

  // Launch browser and take screenshot
  const { page, cleanup } = await createPage(config);

  try {
    await page.goto(url, { waitUntil: config.waitUntil });
    await page.screenshot({ path: config.output!, fullPage: config.fullPage });
    console.log(`${config.width}x${config.height} -> ${config.output}`);
  } finally {
    await page.close();
    await cleanup();
    server?.close();
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

// Run main only when executed directly (not when imported by test)
const runningDirectly =
  process.argv[1] &&
  (process.argv[1].endsWith('screenshot-v2.ts') ||
   process.argv[1].endsWith('screenshot-v2.js') ||
   process.argv[1].endsWith('screenshot-v2'));

if (runningDirectly) {
  main().catch((e: unknown) => {
    console.error('Error:', e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
