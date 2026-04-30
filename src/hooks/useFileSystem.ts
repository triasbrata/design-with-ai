import type { Metadata } from "../types";

const DB_NAME = 'golden-review-fs';
const STORE_NAME = 'directory-handles';
const DB_VERSION = 1;

// ── IndexedDB ──

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveHandle(
  id: string,
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(handle, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadHandle(
  id: string,
): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteHandle(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Directory Picker ──

export function isSupported(): boolean {
  return typeof (window as any).showDirectoryPicker === 'function';
}

export async function pickDirectory(): Promise<{
  name: string;
  handle: FileSystemDirectoryHandle;
} | null> {
  try {
    const showPicker = (window as any).showDirectoryPicker as
      | ((opts?: { mode?: string }) => Promise<FileSystemDirectoryHandle>)
      | undefined;
    if (!showPicker) {
      throw new Error('File System Access API not supported in this browser');
    }
    const handle = await showPicker({ mode: 'readwrite' });
    return { name: handle.name, handle };
  } catch (err) {
    if ((err as Error).name === 'AbortError') return null;
    throw err;
  }
}

export function generateHandleId(): string {
  return `h_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Permission Helpers ──

type FSAHandle = FileSystemDirectoryHandle & {
  queryPermission(desc: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission(desc: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  entries(): AsyncIterableIterator<[string, FileSystemDirectoryHandle | FileSystemFileHandle]>;
};

function toFSA(h: FileSystemDirectoryHandle): FSAHandle {
  return h as unknown as FSAHandle;
}

async function ensureReadPermission(
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  const h = toFSA(handle);
  if ((await h.queryPermission({ mode: 'read' })) === 'granted') return;
  const result = await h.requestPermission({ mode: 'read' });
  if (result !== 'granted') throw new Error('Read permission denied');
}

/** Request read permission from the user. Returns true if granted. */
export async function requestReadPermission(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  const h = toFSA(handle);
  const result = await h.requestPermission({ mode: 'read' });
  return result === 'granted';
}

async function ensureWritePermission(
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  const h = toFSA(handle);
  if ((await h.queryPermission({ mode: 'readwrite' })) === 'granted')
    return;
  const result = await h.requestPermission({ mode: 'readwrite' });
  if (result !== 'granted') throw new Error('Write permission denied');
}

// ── File Operations ──

export async function readFile(
  handle: FileSystemDirectoryHandle,
  fileName: string,
): Promise<string> {
  await ensureReadPermission(handle);
  const fileHandle = await handle.getFileHandle(fileName);
  const file = await fileHandle.getFile();
  return file.text();
}

export async function writeFile(
  handle: FileSystemDirectoryHandle,
  fileName: string,
  content: string | Blob,
): Promise<void> {
  await ensureWritePermission(handle);
  const fileHandle = await handle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

export async function listHtmlFiles(
  handle: FileSystemDirectoryHandle,
): Promise<string[]> {
  await ensureReadPermission(handle);
  const h = toFSA(handle);
  const files: string[] = [];
  for await (const [name, entry] of h.entries()) {
    if (entry.kind === 'file' && name.endsWith('.html')) {
      files.push(name);
    }
  }
  return files;
}

export async function readMetadata(
  handle: FileSystemDirectoryHandle,
): Promise<Record<string, unknown> | null> {
  try {
    const text = await readFile(handle, 'screen-metadata.json');
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Result from scanning a directory for golden spec subdirectories */
export interface GoldenDirResult {
  /** The directory name (last segment) */
  name: string;
  /** Path segments from the picked root to this directory */
  relativePath: string[];
  handle: FileSystemDirectoryHandle;
  screenCount: number;
}

/**
 * Scan subdirectories of a FileSystemDirectoryHandle for screen-metadata.json.
 * Returns directories that contain golden specs, sorted by name.
 * Skips hidden directories (starting with .) and node_modules.
 */
export async function scanForGoldenDirectories(
  rootHandle: FileSystemDirectoryHandle,
): Promise<GoldenDirResult[]> {
  await ensureReadPermission(rootHandle);
  const results: GoldenDirResult[] = [];

  async function walk(dirHandle: FileSystemDirectoryHandle, pathPrefix: string[], depth: number) {
    if (depth > 6) return;
    const dh = toFSA(dirHandle);
    for await (const [name, entry] of dh.entries()) {
      if (entry.kind !== 'directory') continue;
      if (name.startsWith('.') || name === 'node_modules') continue;

      const subHandle = entry as FileSystemDirectoryHandle;
      const meta = await readMetadata(subHandle);
      const entryPath = [...pathPrefix, name];
      if (meta) {
        results.push({
          name,
          relativePath: entryPath,
          handle: subHandle,
          screenCount:
            (meta as any).meta?.totalScreens ??
            Object.keys((meta as any).screens || {}).length,
        });
      }
      // Always walk deeper — golden spec dirs can have nested golden specs
      await walk(subHandle, entryPath, depth + 1);
    }
  }

  // Check root first
  const rootMeta = await readMetadata(rootHandle);
  if (rootMeta) {
    results.push({
      name: rootHandle.name,
      relativePath: [],
      handle: rootHandle,
      screenCount:
        (rootMeta as any).meta?.totalScreens ??
        Object.keys((rootMeta as any).screens || {}).length,
    });
  }

  // Walk subdirectories recursively
  await walk(rootHandle, [], 0);

  return results;
}

/**
 * Resolve a subdirectory handle by walking relative path segments
 * from a root handle. Used to reconstruct child handles that can't
 * be reliably stored in IndexedDB.
 */
export async function resolveHandle(
  rootHandle: FileSystemDirectoryHandle,
  pathSegments: string[],
): Promise<FileSystemDirectoryHandle> {
  await ensureReadPermission(rootHandle);
  let current = rootHandle;
  for (const segment of pathSegments) {
    current = await current.getDirectoryHandle(segment);
  }
  return current;
}

// ── Helpers ──

export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
  const raw = atob(parts[1]);
  const array = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    array[i] = raw.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

// ── Blob / DataURL conversion ──

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// ═══════════════════════════════════════════════════════
//  OPFS (Origin Private File System) Caching Layer
// ═══════════════════════════════════════════════════════

const OPFS_ROOT = 'golden-review-cache-v1';

function safeFolderKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
}

async function getOpfsRoot(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const root = await navigator.storage.getDirectory();
    return root.getDirectoryHandle(OPFS_ROOT, { create: true });
  } catch {
    return null;
  }
}

/** Check if OPFS is available in the current browser. */
export function isOpfsSupported(): boolean {
  return typeof navigator !== 'undefined'
    && 'storage' in navigator
    && typeof (navigator.storage as any).getDirectory === 'function';
}

/** Cache a file in OPFS (silently ignores quota / availability errors). */
export async function cacheFileInOpfs(
  folderKey: string,
  fileName: string,
  content: string | Blob,
): Promise<void> {
  const root = await getOpfsRoot();
  if (!root) return;
  try {
    const dir = await root.getDirectoryHandle(safeFolderKey(folderKey), { create: true });
    const fh = await dir.getFileHandle(fileName, { create: true });
    const w = await fh.createWritable();
    await w.write(content);
    await w.close();
  } catch {
    // quota exceeded or OPFS not supported — silently ignore
  }
}

/** Read a string file from OPFS cache, or null if not found. */
export async function getFromOpfsCache(
  folderKey: string,
  fileName: string,
): Promise<string | null> {
  const root = await getOpfsRoot();
  if (!root) return null;
  try {
    const dir = await root.getDirectoryHandle(safeFolderKey(folderKey));
    const fh = await dir.getFileHandle(fileName);
    const file = await fh.getFile();
    return file.text();
  } catch {
    return null;
  }
}

/** Cache screen-metadata.json in OPFS. */
export async function cacheMetadataInOpfs(
  folderKey: string,
  metadata: Metadata,
): Promise<void> {
  await cacheFileInOpfs(folderKey, '_metadata.json', JSON.stringify(metadata));
}

/** Read screen-metadata.json from OPFS cache. */
export async function getMetadataFromOpfsCache(
  folderKey: string,
): Promise<Metadata | null> {
  const text = await getFromOpfsCache(folderKey, '_metadata.json');
  if (!text) return null;
  try { return JSON.parse(text) as Metadata; } catch { return null; }
}

/** List HTML files stored in OPFS cache for a folder (excludes _metadata.json). */
export async function listOpfsCache(folderKey: string): Promise<string[]> {
  const root = await getOpfsRoot();
  if (!root) return [];
  try {
    const dir = await root.getDirectoryHandle(safeFolderKey(folderKey));
    const names: string[] = [];
    for await (const [name] of (dir as any).entries()) {
      if (name !== '_metadata.json') names.push(name);
    }
    return names;
  } catch {
    return [];
  }
}

/**
 * Preload all files from a FileSource into OPFS cache.
 * This is called once when a folder is activated, so subsequent
 * visits load instantly from the local cache.
 */
export async function preloadOpfsCache(
  source: FileSource,
  folderKey: string,
): Promise<void> {
  // 1. Cache metadata
  const meta = await source.readMetadata();
  if (meta) {
    await cacheMetadataInOpfs(folderKey, meta);
  }

  // 2. Cache all HTML files in the background
  const files = await source.listFiles();
  const htmlFiles = files.filter(f => f.endsWith('.html'));
  for (const file of htmlFiles) {
    try {
      const content = await source.readFile(file);
      await cacheFileInOpfs(folderKey, file, content);
    } catch {
      // skip unreadable files
    }
  }
}

// ═══════════════════════════════════════════════════════
//  FileSource Abstraction
// ═══════════════════════════════════════════════════════

export type FileSourceType = 'fs-api' | 'vite-middleware' | 'upload' | 'unknown';

export const SOURCE_LABELS: Record<FileSourceType, string> = {
  'fs-api': 'FS API',
  'vite-middleware': 'Local Server',
  'upload': 'File Upload',
  'unknown': 'Unknown',
};

export const SOURCE_ICONS: Record<FileSourceType, string> = {
  'fs-api': 'disk',
  'vite-middleware': 'server',
  'upload': 'folder',
  'unknown': 'help',
};

export interface FileSource {
  readonly type: FileSourceType;
  readonly label: string;
  readonly writable: boolean;
  readFile(fileName: string): Promise<string>;
  writeFile(fileName: string, content: string | Blob): Promise<void>;
  readMetadata(): Promise<Metadata | null>;
  listFiles(): Promise<string[]>;
}

/**
 * Detect what file sources are available in the current browser.
 * Returns the most capable source type available.
 */
export function detectFileSource(): { type: FileSourceType; label: string } {
  if (typeof (window as any).showDirectoryPicker === 'function') {
    return { type: 'fs-api', label: SOURCE_LABELS['fs-api'] };
  }
  return { type: 'upload', label: SOURCE_LABELS['upload'] };
}

/**
 * Wrap any FileSource with OPFS read-through caching.
 * Reads check cache first; misses fall through to the real source
 * and automatically populate the cache.
 */
export function withOpfsCache(source: FileSource, folderKey: string): FileSource {
  return {
    ...source,
    async readFile(fileName: string): Promise<string> {
      const cached = await getFromOpfsCache(folderKey, fileName);
      if (cached !== null) return cached;
      const content = await source.readFile(fileName);
      // Fire-and-forget cache write
      cacheFileInOpfs(folderKey, fileName, content).catch(() => {});
      return content;
    },
    async readMetadata(): Promise<Metadata | null> {
      const cached = await getMetadataFromOpfsCache(folderKey);
      if (cached !== null) return cached;
      const meta = await source.readMetadata();
      if (meta) {
        cacheMetadataInOpfs(folderKey, meta).catch(() => {});
      }
      return meta;
    },
  };
}

// ── Factory Functions ──

/**
 * Create a FileSource backed by the File System Access API.
 * Requires a FileSystemDirectoryHandle (obtained via showDirectoryPicker).
 */
export function createFsApiSource(
  inputHandle: FileSystemDirectoryHandle,
  outputHandle?: FileSystemDirectoryHandle,
): FileSource {
  return {
    type: 'fs-api',
    label: 'FS API',
    writable: true,
    readFile: (fileName: string) => readFile(inputHandle, fileName),
    writeFile: (fileName: string, content: string | Blob) =>
      writeFile(outputHandle || inputHandle, fileName, content),
    readMetadata: () => readMetadata(inputHandle) as Promise<Metadata | null>,
    listFiles: () => listHtmlFiles(inputHandle),
  };
}

/**
 * Create a FileSource backed by the Vite dev server middleware.
 * Used when the dev server runs on the same machine (workspace mode).
 */
export function createViteMiddlewareSource(
  inputDir: string,
  outputDir: string,
): FileSource {
  const encInput = encodeURIComponent(inputDir);
  const encOutput = encodeURIComponent(outputDir);

  return {
    type: 'vite-middleware',
    label: 'Local Server',
    writable: true,
    async readFile(fileName: string): Promise<string> {
      const res = await fetch(`/screens/${encodeURIComponent(fileName)}?dir=${encInput}`);
      if (!res.ok) throw new Error(`Read failed: ${fileName} (${res.status})`);
      return res.text();
    },
    async writeFile(fileName: string, content: string | Blob): Promise<void> {
      // Captures are PNG data URLs — POST to /api/capture
      const dataUrl = typeof content === 'string' && content.startsWith('data:')
        ? content
        : content instanceof Blob
          ? await blobToDataUrl(content)
          : (() => { throw new Error('Unsupported content for middleware write'); })();
      const res = await fetch(`/api/capture?dir=${encOutput}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: fileName, data: dataUrl }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error((errBody as any).error || `Write failed (${res.status})`);
      }
    },
    async readMetadata(): Promise<Metadata | null> {
      try {
        const res = await fetch(`/api/metadata?dir=${encInput}`);
        if (!res.ok) return null;
        return res.json() as Promise<Metadata>;
      } catch {
        return null;
      }
    },
    async listFiles(): Promise<string[]> {
      const meta = await this.readMetadata();
      if (!meta) return [];
      return Object.keys(meta.screens).map(s => `${s}_spec.html`);
    },
  };
}

/**
 * Create a FileSource for browser-uploaded files (webkitdirectory / drag-and-drop).
 * This source is read-only.
 */
export function createUploadSource(
  files: Array<{ name: string; blobUrl: string }>,
  metadata: Metadata,
): FileSource {
  const fileMap = new Map(files.map(f => [f.name, f.blobUrl]));

  return {
    type: 'upload',
    label: 'File Upload',
    writable: false,
    async readFile(fileName: string): Promise<string> {
      const blobUrl = fileMap.get(fileName);
      if (!blobUrl) throw new Error(`File not found: ${fileName}`);
      const res = await fetch(blobUrl);
      return res.text();
    },
    async writeFile(): Promise<void> {
      throw new Error('Upload source is read-only');
    },
    async readMetadata(): Promise<Metadata | null> {
      return metadata;
    },
    async listFiles(): Promise<string[]> {
      return files.map(f => f.name);
    },
  };
}

/**
 * Smart factory: picks the best FileSource for the given configuration.
 *
 * Priority:
 *   1. FS Access API handles (when user granted directory permission)
 *   2. Client project (uploaded files via webkitdirectory)
 *   3. Vite middleware (workspace with path-based dirs)
 *
 * Returns null when no source can be determined (e.g., no active project).
 */
export function createFileSource(
  config: {
    projectType?: 'workspace' | 'client';
    inputDir?: string;
    outputDir?: string;
    inputHandle?: FileSystemDirectoryHandle | null;
    outputHandle?: FileSystemDirectoryHandle | null;
    uploadFiles?: Array<{ name: string; blobUrl: string }>;
    uploadMetadata?: Metadata | null;
  },
): FileSource | null {
  const { projectType, inputHandle, outputHandle, inputDir, outputDir, uploadFiles, uploadMetadata } = config;

  // Priority 1: FS Access API (native browser file system access)
  if (inputHandle) {
    return createFsApiSource(inputHandle, outputHandle ?? undefined);
  }

  // Priority 2: Client project with uploaded files
  if (projectType === 'client' && uploadFiles && uploadFiles.length > 0 && uploadMetadata) {
    return createUploadSource(uploadFiles, uploadMetadata);
  }

  // Priority 3: Vite middleware (workspace mode, server-side file access)
  if (inputDir) {
    return createViteMiddlewareSource(inputDir, outputDir || inputDir);
  }

  return null;
}
