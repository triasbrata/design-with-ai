import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import fs from "node:fs";
import type { Plugin } from "vite";
import { acpPlugin } from "./src/acp/acp-vite-plugin.js";

const GOLDEN_DIR = path.resolve(
  process.env.GOLDEN_DIR || path.join(__dirname, "../../docs/moneykitty/design/golden"),
);

/** Project root (two levels up from tools/screenshot_device_html) */
const REPO_ROOT = path.resolve(__dirname, "../..");

/** Allowed base directories for multi-project dir resolution */
const ALLOWED_BASES = [path.resolve(__dirname, "../../docs"), path.resolve(__dirname, "../../packages")];

/**
 * Resolve a ?dir= query param to an absolute path.
 * Falls back to GOLDEN_DIR if invalid or missing.
 *
 * Resolution order:
 *   1. Relative to __dirname  — supports existing configs with paths like "../../docs/moneykitty/..."
 *   2. Relative to REPO_ROOT  — supports user-typed paths like "docs/moneymanager/design/golden/"
 */
function resolveDir(queryDir: string | null): string {
  if (!queryDir) return GOLDEN_DIR;

  // Try relative to the tool directory (backward compatible with existing saved configs)
  const fromCwd = path.resolve(__dirname, queryDir);
  if (ALLOWED_BASES.some((base) => fromCwd.startsWith(base))) {
    return fromCwd;
  }

  // Try relative to the repo root (for user-typed paths like "docs/moneymanager/design/golden/")
  const fromRoot = path.resolve(REPO_ROOT, queryDir);
  if (ALLOWED_BASES.some((base) => fromRoot.startsWith(base))) {
    return fromRoot;
  }

  return GOLDEN_DIR;
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

      // ── /api/scan-folders — find all screen-metadata.json under docs/ ──
      server.middlewares.use("/api/scan-folders", async (_req, res) => {
        const results: { name: string; path: string; screenCount: number }[] = [];

        for (const base of ALLOWED_BASES) {
          if (!fs.existsSync(base)) continue;
          const scanDir = (dir: string) => {
            try {
              for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
                  scanDir(path.join(dir, entry.name));
                }
              }
              const metaPath = path.join(dir, "screen-metadata.json");
              if (fs.existsSync(metaPath)) {
                try {
                  const raw = fs.readFileSync(metaPath, "utf-8");
                  const meta = JSON.parse(raw);
                  const relPath = path.relative(REPO_ROOT, dir);
                  // Derive descriptive name from path: "moneykitty/design/golden" → "MoneyKitty Golden"
                  const pathParts = relPath.split(path.sep);
                  const projectIdx = pathParts.indexOf("golden") - 1;
                  const projectName = projectIdx >= 0 ? pathParts[projectIdx] : pathParts[0];
                  const displayName = projectName
                    .replace(/[_-]/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase());
                  results.push({
                    name: displayName,
                    path: relPath,
                    screenCount:
                      meta.meta?.totalScreens ??
                      Object.keys(meta.screens || {}).length,
                  });
                } catch {
                  /* skip invalid json */
                }
              }
            } catch {
              /* skip permission errors */
            }
          };
          scanDir(base);
        }

        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ folders: results }));
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
  plugins: [tailwindcss(), react(), capturePlugin(), acpPlugin()],
  server: {
    port: 4200,
    open: false,
  },
});
