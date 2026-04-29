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
