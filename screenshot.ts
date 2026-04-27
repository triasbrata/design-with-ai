import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, statSync } from 'fs';
import { extname, resolve } from 'path';
import { AddressInfo } from 'net';

async function main() {
  const width = parseInt(process.env.DEVICE_WIDTH || '390');
  const height = parseInt(process.env.DEVICE_HEIGHT || '844');
  const input = process.env.PATH_URL!;
  const output = process.env.OUTPUT || 'screenshot.png';

  if (!input) {
    console.error('PATH_URL required. Usage: PATH_URL=./file.html npx tsx screenshot.ts');
    process.exit(1);
  }

  // If already a URL, use directly. Otherwise, serve local file via HTTP.
  let url: string;
  let server: ReturnType<typeof createServer> | null = null;

  if (input.startsWith('http://') || input.startsWith('https://')) {
    url = input;
  } else {
    const filePath = resolve(input);
    if (!statSync(filePath).isFile()) throw new Error(`Not found: ${filePath}`);

    const mime: Record<string, string> = {
      '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
      '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json',
    };
    const ext = extname(filePath);
    const contentType = mime[ext] || 'application/octet-stream';
    const body = readFileSync(filePath);

    server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(body);
    });
    await new Promise<void>((ok) => server!.listen(0, ok));
    const port = (server!.address() as AddressInfo).port;
    url = `http://localhost:${port}/${filePath.split('/').pop()}`;
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width, height });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.screenshot({ path: output, fullPage: false });
  console.log(`${width}x${height} → ${output}`);
  await browser.close();
  server?.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
