import { app } from "electron";

/**
 * Suppresses known-harmless Chromium DevTools log spam that appears in the
 * terminal when DevTools is open (e.g. `Unknown VE context`,
 * `Request Autofill.enable failed`). These are written by Chromium's native
 * logger directly to the stderr file descriptor, bypassing Node's
 * `process.stderr.write`, so they can only be silenced at the Chromium level.
 *
 * `--log-level=3` raises the minimum severity printed to stderr to FATAL,
 * dropping the ERROR-level console noise. App logging goes through
 * `electron-log` (a separate channel) and the DevTools console panel still
 * shows everything, so neither is affected.
 *
 * Must be called before `app` is ready. No-op in production, where DevTools
 * is not opened.
 */
export function suppressDevToolsNoise(): void {
  if (!process.env.VITE_DEV_SERVER_URL) return;
  app.commandLine.appendSwitch("log-level", "3");
}
