import Store from "electron-store";
import log from "electron-log/main";

/**
 * Tiny persisted TTL cache for read-only YouTube responses.
 *
 * Reads from the YouTube Data API are cheap (~1 quota unit each), so this layer
 * exists for UX latency — instant screen re-entry — and as a foundation for
 * offline reads, not for quota savings. Writes (videos.update / captions.insert)
 * are never cached and must invalidate the affected keys.
 */

type Entry<T> = { data: T; fetchedAt: number };

type CacheShape = { entries: Record<string, Entry<unknown>> };

export const TTL = {
  CHANNELS: 30 * 60 * 1000,
  VIDEOS: 10 * 60 * 1000,
  VIDEO: 10 * 60 * 1000,
  CAPTIONS: 10 * 60 * 1000,
} as const;

const store = new Store<CacheShape>({
  name: "youclicker-cache",
  defaults: { entries: {} },
});

function readEntry<T>(key: string): Entry<T> | null {
  const entries = store.get("entries");
  const hit = entries[key] as Entry<T> | undefined;
  return hit ?? null;
}

function writeEntry<T>(key: string, data: T, fetchedAt: number): void {
  const entries = { ...store.get("entries"), [key]: { data, fetchedAt } };
  store.set("entries", entries);
}

/**
 * Return a cached value if present and fresher than `ttlMs`; otherwise run
 * `loader`, cache its result, and return it. `force` bypasses the cache read
 * (used by the renderer's "Refresh" action) while still refreshing the entry.
 */
export async function withCache<T>(
  key: string,
  ttlMs: number,
  force: boolean,
  loader: () => Promise<T>,
): Promise<T> {
  if (!force) {
    const hit = readEntry<T>(key);
    if (hit && Date.now() - hit.fetchedAt < ttlMs) {
      log.info("[cache] hit", { key });
      return hit.data;
    }
  }
  const data = await loader();
  writeEntry(key, data, Date.now());
  return data;
}

/** Drop every cache entry whose key starts with one of the given prefixes. */
export function invalidate(...prefixes: string[]): void {
  const entries = store.get("entries");
  const next: Record<string, Entry<unknown>> = {};
  let removed = 0;
  for (const [key, value] of Object.entries(entries)) {
    if (prefixes.some((p) => key.startsWith(p))) {
      removed += 1;
      continue;
    }
    next[key] = value;
  }
  if (removed > 0) {
    store.set("entries", next);
    log.info("[cache] invalidated", { prefixes, removed });
  }
}
