/**
 * Minimal semver comparison for the update check. Compares major.minor.patch
 * only (ignoring pre-release/build metadata). Pure and dependency-free.
 */
export function parseVersion(v: string): [number, number, number] {
  const parts = v
    .trim()
    .replace(/^v/i, "")
    .split(/[.\-+]/)
    .map((n) => Number.parseInt(n, 10));
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

/** True when `latest` is a strictly higher version than `current`. */
export function isNewer(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}
