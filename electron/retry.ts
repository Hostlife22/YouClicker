import log from "electron-log/main";

/**
 * Bounded exponential-backoff retry for transient network/API failures.
 * Retries only on rate-limit (429) and server (5xx) HTTP statuses and on
 * transient socket errors — never on auth failures (401/403), which must
 * surface so the UI can prompt re-authentication.
 */

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRYABLE_NETWORK_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNREFUSED",
]);

function statusOf(err: unknown): number | undefined {
  const e = err as {
    status?: unknown;
    code?: unknown;
    response?: { status?: unknown };
  };
  if (typeof e?.response?.status === "number") return e.response.status;
  if (typeof e?.status === "number") return e.status;
  if (typeof e?.code === "number") return e.code;
  return undefined;
}

export function isRetryable(err: unknown): boolean {
  const status = statusOf(err);
  if (status !== undefined) return RETRYABLE_STATUS.has(status);
  const code = (err as { code?: unknown })?.code;
  return typeof code === "string" && RETRYABLE_NETWORK_CODES.has(code);
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseDelayMs?: number; label?: string } = {},
): Promise<T> {
  const { retries = 3, baseDelayMs = 500, label = "op" } = opts;
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      if (attempt > retries || !isRetryable(err)) throw err;
      const delay = baseDelayMs * 2 ** (attempt - 1);
      log.warn("[retry] transient failure, retrying", {
        label,
        attempt,
        delay,
        err: String(err),
      });
      await sleep(delay);
    }
  }
}
