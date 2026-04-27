import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve, join } from 'path';
import { writeFileSync, mkdtempSync, rmSync, realpathSync } from 'fs';
import { tmpdir } from 'os';
import { IncomingMessage, request as httpRequest } from 'http';

import {
  parseArgs,
  defaultOutputName,
  mergeConfig,
  createFileServer,
  DEFAULTS,
  USER_DATA_DIR,
  ScreenshotConfig,
  CliFlags,
} from './screenshot-v2';

// ─── Helper: fetch from local server ─────────────────────────────────────────

function fetchUrl(url: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const req = httpRequest(url, (res: IncomingMessage) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolvePromise(Buffer.concat(chunks).toString('utf-8')));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('parseArgs', () => {
  it('returns empty flags when no args', () => {
    const flags = parseArgs(['node', 'script.ts']);
    expect(flags).toEqual({});
  });

  it('parses --url', () => {
    const flags = parseArgs(['node', 'script.ts', '--url', './test.html']);
    expect(flags.url).toBe('./test.html');
  });

  it('parses --width and --height', () => {
    const flags = parseArgs(['node', 'script.ts', '--width', '414', '--height', '896']);
    expect(flags.width).toBe(414);
    expect(flags.height).toBe(896);
  });

  it('parses --output', () => {
    const flags = parseArgs(['node', 'script.ts', '--output', 'out.png']);
    expect(flags.output).toBe('out.png');
  });

  it('parses --config', () => {
    const flags = parseArgs(['node', 'script.ts', '--config', 'myconfig.json']);
    expect(flags.config).toBe('myconfig.json');
  });

  it('parses --json', () => {
    const flags = parseArgs(['node', 'script.ts', '--json', '{"url":"test.html"}']);
    expect(flags.json).toBe('{"url":"test.html"}');
  });

  it('parses --browser', () => {
    const flags = parseArgs(['node', 'script.ts', '--browser', 'chrome']);
    expect(flags.browser).toBe('chrome');
  });
});

describe('defaultOutputName', () => {
  it('generates from .html file', () => {
    expect(defaultOutputName('./spec.html', 390, 844)).toBe('spec_390x844.png');
  });

  it('generates from URL', () => {
    expect(defaultOutputName('https://example.com/page', 390, 844)).toBe('page_390x844.png');
  });

  it('handles path with directories', () => {
    expect(defaultOutputName('/some/long/path/file.html', 414, 896)).toBe('file_414x896.png');
  });

  it('handles file without extension', () => {
    expect(defaultOutputName('./myfile', 390, 844)).toBe('myfile_390x844.png');
  });
});

describe('mergeConfig', () => {
  it('uses defaults when nothing is provided', () => {
    const config = mergeConfig({});
    expect(config.width).toBe(DEFAULTS.width);
    expect(config.height).toBe(DEFAULTS.height);
    expect(config.useExistingBrowser).toBe(false);
    expect(config.fullPage).toBe(false);
    expect(config.deviceScaleFactor).toBe(2);
    expect(config.waitUntil).toBe('networkidle');
    expect(config.browser).toBe('chromium');
  });

  it('generates default output when not specified', () => {
    const config = mergeConfig({ url: './test.html' });
    expect(config.output).toBe('test_390x844.png');
  });

  it('fileConfig overrides defaults', () => {
    const fileConfig: ScreenshotConfig = {
      url: './from_file.html',
      width: 414,
      height: 896,
    };
    const config = mergeConfig({}, fileConfig);
    expect(config.url).toBe('./from_file.html');
    expect(config.width).toBe(414);
    expect(config.height).toBe(896);
  });

  it('jsonConfig overrides fileConfig', () => {
    const fileConfig: ScreenshotConfig = { url: './file.html', width: 390, height: 844 };
    const jsonConfig: ScreenshotConfig = { url: './file.html', width: 414, height: 896 };
    const config = mergeConfig({}, fileConfig, jsonConfig);
    expect(config.width).toBe(414);
    expect(config.height).toBe(896);
  });

  it('flags override everything', () => {
    const fileConfig: ScreenshotConfig = { url: './file.html', width: 390, height: 844 };
    const jsonConfig: ScreenshotConfig = { url: './file.html', width: 414, height: 896 };
    const flags: CliFlags = { url: './override.html', width: 768, height: 1024 };
    const config = mergeConfig(flags, fileConfig, jsonConfig);
    expect(config.url).toBe('./override.html');
    expect(config.width).toBe(768);
    expect(config.height).toBe(1024);
  });

  it('flag browser overrides', () => {
    const flags: CliFlags = { browser: 'chrome' };
    const config = mergeConfig(flags);
    expect(config.browser).toBe('chrome');
  });

  it('PATH_URL env var maps to flags.url before merge', () => {
    // Simulate what main() does: inject PATH_URL into flags.url
    const flags: CliFlags = { url: './test.html' };
    const config = mergeConfig(flags);
    expect(config.url).toBe('./test.html');
    expect(config.output).toBe('test_390x844.png');
  });
});

describe('createFileServer', () => {
  let tmpDir: string;
  const testFiles: string[] = [];

  beforeAll(() => {
    // Create temp dir with test files
    tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'screenshot-test-')));
    writeFileSync(join(tmpDir, 'index.html'), '<html><body>Hello</body></html>');
    writeFileSync(join(tmpDir, 'style.css'), 'body { color: red; }');
    testFiles.push(tmpDir);
  });

  afterAll(() => {
    for (const f of testFiles) {
      try { rmSync(f, { recursive: true }); } catch { /* ignore */ }
    }
  });

  it('serves an HTML file', async () => {
    const htmlPath = join(tmpDir, 'index.html');
    const { url, server } = await createFileServer(htmlPath);
    try {
      const body = await fetchUrl(url);
      expect(body).toBe('<html><body>Hello</body></html>');
    } finally {
      server.close();
    }
  });

  it('serves CSS files from same directory', async () => {
    const htmlPath = join(tmpDir, 'index.html');
    const { url, server } = await createFileServer(htmlPath);
    try {
      const cssBody = await fetchUrl(url.replace('index.html', 'style.css'));
      expect(cssBody).toBe('body { color: red; }');
    } finally {
      server.close();
    }
  });

  it('returns "Not found" for missing files', async () => {
    const htmlPath = join(tmpDir, 'index.html');
    const { url, server } = await createFileServer(htmlPath);
    try {
      const notFoundUrl = url.replace('index.html', 'nonexistent.js');
      const body = await fetchUrl(notFoundUrl);
      expect(body).toBe('Not found');
    } finally {
      server.close();
    }
  });

  it('rejects for non-existent file', async () => {
    await expect(
      createFileServer('/tmp/nonexistent_file_xyz.html'),
    ).rejects.toThrow('File not found');
  });
});

describe('static exports', () => {
  it('DEFAULTS has expected shape', () => {
    expect(DEFAULTS).toHaveProperty('url');
    expect(DEFAULTS).toHaveProperty('width');
    expect(DEFAULTS).toHaveProperty('height');
    expect(DEFAULTS.width).toBe(390);
    expect(DEFAULTS.height).toBe(844);
  });

  it('USER_DATA_DIR is a non-empty string', () => {
    expect(typeof USER_DATA_DIR).toBe('string');
    expect(USER_DATA_DIR.length).toBeGreaterThan(0);
    expect(USER_DATA_DIR).toContain('Google');
    expect(USER_DATA_DIR).toContain('Chrome');
  });
});
