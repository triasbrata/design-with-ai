import { defineConfig } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import type { Plugin } from 'vite';

const GOLDEN_DIR = path.resolve(
  process.env.GOLDEN_DIR || path.join(__dirname, '../../docs/moneykitty/design/golden')
);

function capturePlugin(): Plugin {
  return {
    name: 'capture-api',
    configureServer(server) {
      server.middlewares.use('/api/capture', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ ok: false, error: 'POST only' }));
          return;
        }
        let body = '';
        req.on('data', (c) => { body += c; if (body.length > 5e6) req.destroy(); });
        req.on('end', () => {
          try {
            const { filename, data } = JSON.parse(body);
            const safe = path.basename((filename || 'screen').replace(/\.png$/i, '') + '.png');
            if (!safe.endsWith('.png')) throw new Error('Invalid filename');
            const outPath = path.join(GOLDEN_DIR, safe);
            const base64 = (data || '').replace(/^data:image\/png;base64,/, '');
            fs.writeFileSync(outPath, Buffer.from(base64, 'base64'));
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, path: safe }));
          } catch (e: any) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: e.message }));
          }
        });
      });

      // Proxy /screens/* → golden dir for clean URLs
      server.middlewares.use('/screens', (req, res, next) => {
        const filePath = path.join(GOLDEN_DIR, (req.url || '/').replace(/^\/screens\//, ''));
        // Only serve existing files, let Vite handle 404s
        if (fs.existsSync(filePath)) {
          const ext = path.extname(filePath);
          const mime: Record<string, string> = {
            '.html': 'text/html; charset=utf-8',
            '.png': 'image/png',
            '.json': 'application/json',
          };
          res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
          fs.createReadStream(filePath).pipe(res);
        } else {
          res.statusCode = 404;
          res.end('Not found');
        }
      });
    },
  };
}

export default defineConfig({
  root: __dirname,
  plugins: [capturePlugin()],
  server: {
    port: 4200,
    open: false,
  },
});
