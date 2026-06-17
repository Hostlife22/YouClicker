import { describe, it, expect, vi } from "vitest";
import { isRetryable, withRetry } from "../electron/retry";

describe("isRetryable", () => {
  it("retries on rate-limit and server statuses", () => {
    expect(isRetryable({ response: { status: 429 } })).toBe(true);
    expect(isRetryable({ status: 503 })).toBe(true);
    expect(isRetryable({ code: 500 })).toBe(true);
  });

  it("does not retry auth failures", () => {
    expect(isRetryable({ response: { status: 401 } })).toBe(false);
    expect(isRetryable({ status: 403 })).toBe(false);
    expect(isRetryable({ status: 404 })).toBe(false);
  });

  it("retries transient socket errors but not unknown ones", () => {
    expect(isRetryable({ code: "ECONNRESET" })).toBe(true);
    expect(isRetryable({ code: "ETIMEDOUT" })).toBe(true);
    expect(isRetryable({ code: "SOMETHING_ELSE" })).toBe(false);
    expect(isRetryable(new Error("plain"))).toBe(false);
    expect(isRetryable(undefined)).toBe(false);
  });
});

describe("withRetry", () => {
  it("returns immediately on success without retrying", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(withRetry(fn, { baseDelayMs: 0 })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries a transient failure then succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValue("ok");
    await expect(withRetry(fn, { baseDelayMs: 0, retries: 2 })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws non-retryable errors immediately", async () => {
    const fn = vi.fn().mockRejectedValue({ status: 403 });
    await expect(withRetry(fn, { baseDelayMs: 0, retries: 3 })).rejects.toEqual({
      status: 403,
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("gives up after exhausting retries on a persistent transient error", async () => {
    const fn = vi.fn().mockRejectedValue({ status: 500 });
    await expect(withRetry(fn, { baseDelayMs: 0, retries: 2 })).rejects.toEqual({
      status: 500,
    });
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });
});
