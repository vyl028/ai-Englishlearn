export type AiCacheKind = 'define' | 'practice' | 'story';

type AiCacheEntry<T> = {
  v: 1;
  kind: AiCacheKind;
  createdAt: number;
  expiresAt: number;
  data: T;
};

type AiCacheIndexEntry = {
  key: string;
  kind: AiCacheKind;
  createdAt: number;
  expiresAt: number;
  size: number;
};

type AiCacheIndex = {
  v: 1;
  entries: AiCacheIndexEntry[];
};

const INDEX_KEY = 'lexi-capture-ai-cache-v1:index';
const ENTRY_PREFIX = 'lexi-capture-ai-cache-v1:entry:';

const DEFAULT_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const DEFAULT_MAX_ENTRIES = 30;
const DEFAULT_MAX_BYTES = 900_000; // ~0.9MB

function getStorage(): Storage | null {
  try {
    // eslint-disable-next-line no-undef
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function now() {
  return Date.now();
}

// FNV-1a 32-bit hash (fast, stable, good enough for cache keys)
function fnv1a32(str: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // unsigned 32-bit
  return hash >>> 0;
}

export function hashAiCachePayload(payload: unknown) {
  const json = JSON.stringify(payload);
  const h = fnv1a32(json);
  return h.toString(16).padStart(8, '0');
}

function readIndex(storage: Storage): AiCacheIndex {
  try {
    const raw = storage.getItem(INDEX_KEY);
    if (!raw) return { v: 1, entries: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.entries)) return { v: 1, entries: [] };
    return {
      v: 1,
      entries: parsed.entries.filter((e: any) => e && typeof e.key === 'string'),
    };
  } catch {
    return { v: 1, entries: [] };
  }
}

function writeIndex(storage: Storage, index: AiCacheIndex) {
  storage.setItem(INDEX_KEY, JSON.stringify(index));
}

function entryKey(kind: AiCacheKind, hash: string) {
  return `${ENTRY_PREFIX}${kind}:${hash}`;
}

function pruneIndex(storage: Storage, index: AiCacheIndex, opts: { maxEntries: number; maxBytes: number }) {
  const t = now();
  const existingKeys = new Set<string>();
  const cleaned: AiCacheIndexEntry[] = [];

  for (const e of index.entries) {
    if (!e || typeof e.key !== 'string') continue;
    if (existingKeys.has(e.key)) continue;
    existingKeys.add(e.key);
    if (typeof e.expiresAt === 'number' && e.expiresAt > 0 && e.expiresAt <= t) {
      try {
        storage.removeItem(e.key);
      } catch {
        // ignore
      }
      continue;
    }
    cleaned.push(e);
  }

  cleaned.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  while (cleaned.length > opts.maxEntries) {
    const removed = cleaned.pop();
    if (!removed) break;
    try {
      storage.removeItem(removed.key);
    } catch {
      // ignore
    }
  }

  const totalBytes = () => cleaned.reduce((sum, e) => sum + (typeof e.size === 'number' ? e.size : 0), 0);
  while (cleaned.length > 0 && totalBytes() > opts.maxBytes) {
    const removed = cleaned.pop();
    if (!removed) break;
    try {
      storage.removeItem(removed.key);
    } catch {
      // ignore
    }
  }

  return { v: 1, entries: cleaned } satisfies AiCacheIndex;
}

export function getAiCache<T>(kind: AiCacheKind, hash: string): T | null {
  const storage = getStorage();
  if (!storage) return null;

  const key = entryKey(kind, hash);
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as AiCacheEntry<T>;
    if (!entry || entry.v !== 1 || entry.kind !== kind) return null;
    if (typeof entry.expiresAt === 'number' && entry.expiresAt > 0 && entry.expiresAt <= now()) {
      storage.removeItem(key);
      const index = readIndex(storage);
      writeIndex(storage, { v: 1, entries: index.entries.filter((e) => e.key !== key) });
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function setAiCache<T>(
  kind: AiCacheKind,
  hash: string,
  data: T,
  opts?: { ttlMs?: number; maxEntries?: number; maxBytes?: number }
) {
  const storage = getStorage();
  if (!storage) return;

  const ttlMs = typeof opts?.ttlMs === 'number' ? Math.max(1, opts!.ttlMs) : DEFAULT_TTL_MS;
  const maxEntries = typeof opts?.maxEntries === 'number' ? Math.max(1, opts!.maxEntries) : DEFAULT_MAX_ENTRIES;
  const maxBytes = typeof opts?.maxBytes === 'number' ? Math.max(10_000, opts!.maxBytes) : DEFAULT_MAX_BYTES;

  const key = entryKey(kind, hash);
  const createdAt = now();
  const expiresAt = createdAt + ttlMs;
  const entry: AiCacheEntry<T> = { v: 1, kind, createdAt, expiresAt, data };

  const entryJson = JSON.stringify(entry);
  const size = entryJson.length;

  const write = () => storage.setItem(key, entryJson);

  try {
    write();
  } catch {
    // Best-effort: prune then retry once.
    try {
      const idx0 = readIndex(storage);
      const pruned0 = pruneIndex(storage, idx0, { maxEntries: Math.max(5, Math.floor(maxEntries / 2)), maxBytes: Math.max(200_000, Math.floor(maxBytes / 2)) });
      writeIndex(storage, pruned0);
      write();
    } catch {
      return;
    }
  }

  const index = readIndex(storage);
  const nextIndex: AiCacheIndex = {
    v: 1,
    entries: [
      { key, kind, createdAt, expiresAt, size },
      ...index.entries.filter((e) => e.key !== key),
    ],
  };

  const pruned = pruneIndex(storage, nextIndex, { maxEntries, maxBytes });
  try {
    writeIndex(storage, pruned);
  } catch {
    // ignore
  }
}

export function clearAiCache() {
  const storage = getStorage();
  if (!storage) return;
  const index = readIndex(storage);
  for (const e of index.entries) {
    try {
      storage.removeItem(e.key);
    } catch {
      // ignore
    }
  }
  try {
    storage.removeItem(INDEX_KEY);
  } catch {
    // ignore
  }
}

