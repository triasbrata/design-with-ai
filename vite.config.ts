import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import fs from "node:fs";
import type { Plugin } from "vite";

const GOLDEN_DIR = path.resolve(
  process.env.GOLDEN_DIR || path.join(__dirname, "../../docs/moneykitty/design/golden"),
);

/** Allowed base directories for multi-project dir resolution */
const ALLOWED_BASES = [path.resolve(__dirname, "../../docs"), path.resolve(__dirname, "../../packages")];

/**
 * Resolve a ?dir= query param to an absolute path.
 * Falls back to GOLDEN_DIR if invalid or missing.
 */
function resolveDir(queryDir: string | null): string {
  if (!queryDir) return GOLDEN_DIR;
  const resolved = path.resolve(__dirname, queryDir);
  const allowed = ALLOWED_BASES.some((base) => resolved.startsWith(base));
  if (!allowed) return GOLDEN_DIR;
  return resolved;
}

function capturePlugin(): Plugin {
  return {
    name: "capture-api",
    configureServer(server) {
      // ── /api/metadata — fetch screen-metadata.json from specified dir ──
      server.middlewares.use("/api/metadata", (req, res) => {
        if (req.method !== "GET") {
          res.statusCode = 405;
          res.end(JSON.stringify({ ok: false, error: "GET only" }));
          return;
        }
        try {
          const url = new URL(req.url || "/", "http://localhost");
          const dir = resolveDir(url.searchParams.get("dir"));
          const metaPath = path.join(dir, "screen-metadata.json");
          if (!fs.existsSync(metaPath)) {
            res.statusCode = 404;
            res.end(JSON.stringify({ ok: false, error: "screen-metadata.json not found" }));
            return;
          }
          const data = fs.readFileSync(metaPath, "utf-8");
          res.setHeader("Content-Type", "application/json");
          res.end(data);
        } catch (e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });

      // ── /api/capture — POST save PNG to specified dir ──
      server.middlewares.use("/api/capture", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ ok: false, error: "POST only" }));
          return;
        }
        let body = "";
        req.on("data", (c) => {
          body += c;
          if (body.length > 5e6) req.destroy();
        });
        req.on("end", () => {
          try {
            const url = new URL(req.url || "/", "http://localhost");
            const dir = resolveDir(url.searchParams.get("dir"));
            const { filename, data } = JSON.parse(body);
            const safe = path.basename((filename || "screen").replace(/\.png$/i, "") + ".png");
            if (!safe.endsWith(".png")) throw new Error("Invalid filename");
            const outPath = path.join(dir, safe);
            const base64 = (data || "").replace(/^data:image\/png;base64,/, "");
            fs.writeFileSync(outPath, Buffer.from(base64, "base64"));
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, path: safe }));
          } catch (e: any) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, error: e.message }));
          }
        });
      });

      // ── /screens/* — serve static files from specified dir ──
      server.middlewares.use("/screens", (req, res) => {
        try {
          const url = new URL(req.url || "/", "http://localhost");
          const dir = resolveDir(url.searchParams.get("dir"));
          const filename = url.pathname.replace(/^\/screens\//, "");
          const filePath = path.join(dir, filename);
          if (fs.existsSync(filePath)) {
            const ext = path.extname(filePath);
            const mime: Record<string, string> = {
              ".html": "text/html; charset=utf-8",
              ".png": "image/png",
              ".json": "application/json",
            };
            res.setHeader("Content-Type", mime[ext] || "application/octet-stream");
            fs.createReadStream(filePath).pipe(res);
          } else {
            res.statusCode = 404;
            res.end("Not found");
          }
        } catch {
          res.statusCode = 400;
          res.end("Bad request");
        }
      });
    },
  };
}

export default defineConfig({
  root: __dirname,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  plugins: [tailwindcss(), react(), capturePlugin()],
  server: {
    port: 4200,
    open: false,
  },
});
