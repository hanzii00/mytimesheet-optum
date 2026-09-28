const CACHE_PREFIX = "attendance-portal:cache:";

// Survives client-side navigation between pages; localStorage survives reloads.
const memory = new Map<string, unknown>();

export function readCache<T>(key: string): T | null {
  if (memory.has(key)) return memory.get(key) as T;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T;
    memory.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, value: T) {
  memory.set(key, value);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable — the in-memory copy still works for this session.
  }
}

export function clearCache(predicate: (key: string) => boolean) {
  for (const key of Array.from(memory.keys())) {
    if (predicate(key)) memory.delete(key);
  }
  if (typeof window === "undefined") return;
  try {
    for (const storageKey of Object.keys(window.localStorage)) {
      if (!storageKey.startsWith(CACHE_PREFIX)) continue;
      if (predicate(storageKey.slice(CACHE_PREFIX.length))) window.localStorage.removeItem(storageKey);
    }
  } catch {
    // Ignore storage access failures.
  }
}

export const recordsCacheKey = (month: string) => `records:${month}`;
export const SHIFT_CACHE_KEY = "shift";

export const clearRecordsCache = () => clearCache((key) => key.startsWith("records:"));
