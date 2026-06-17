import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import keytar from "keytar";
import { shell } from "electron";
import http from "node:http";
import { URL } from "node:url";
import crypto from "node:crypto";
import log from "electron-log/main";
import type { Account } from "../shared/types";
import {
  getSettings,
  getAccounts,
  addAccount as persistAccount,
  removeAccount as forgetAccount,
} from "./store";
import { invalidate } from "./cache";

const KEYTAR_SERVICE = "YouClickerPersonal";
/** Per-account refresh-token key. */
const refreshKey = (email: string): string => `refresh:${email}`;

// Legacy single-account keys (pre multi-account). Migrated on startup.
const LEGACY_REFRESH = "google-oauth-refresh-token";
const LEGACY_EMAIL = "google-oauth-email";

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube.force-ssl",
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/userinfo.email",
];

const clients = new Map<string, OAuth2Client>();

/** Build (and cache) an authorized client for one connected account. */
export async function getAuthClient(email: string): Promise<OAuth2Client> {
  const cached = clients.get(email);
  if (cached) return cached;

  const { googleClientId, googleClientSecret } = getSettings();
  if (!googleClientId || !googleClientSecret) {
    throw new Error("MISSING_OAUTH_CREDENTIALS");
  }
  const refreshToken = await keytar.getPassword(KEYTAR_SERVICE, refreshKey(email));
  if (!refreshToken) {
    throw new Error("NOT_AUTHENTICATED");
  }
  const client = new google.auth.OAuth2(googleClientId, googleClientSecret);
  client.setCredentials({ refresh_token: refreshToken });
  client.on("tokens", (tokens) => {
    if (tokens.refresh_token) {
      void keytar.setPassword(KEYTAR_SERVICE, refreshKey(email), tokens.refresh_token);
    }
  });
  clients.set(email, client);
  return client;
}

export function listAccounts(): Account[] {
  return getAccounts();
}

/**
 * Run the OAuth flow under a freshly chosen Google account and remember it.
 * `select_account` lets the user pick a different account than any already
 * connected one; `consent` guarantees a refresh token is returned.
 */
export async function addAccount(): Promise<Account> {
  const { googleClientId, googleClientSecret } = getSettings();
  if (!googleClientId || !googleClientSecret) {
    throw new Error("MISSING_OAUTH_CREDENTIALS");
  }

  const { port, server, codePromise } = await startLoopbackServer();
  const redirectUri = `http://127.0.0.1:${port}/oauth/callback`;
  const state = crypto.randomBytes(16).toString("hex");

  const client = new google.auth.OAuth2(googleClientId, googleClientSecret, redirectUri);
  const authUrl = client.generateAuthUrl({
    access_type: "offline",
    prompt: "select_account consent",
    scope: SCOPES,
    state,
  });

  log.info("[oauth] opening browser for new account", { redirectUri });
  await shell.openExternal(authUrl);

  try {
    const { code, returnedState } = await codePromise;
    if (returnedState !== state) {
      throw new Error("OAUTH_STATE_MISMATCH");
    }
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) {
      throw new Error("NO_REFRESH_TOKEN_RECEIVED");
    }

    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const me = await oauth2.userinfo.get();
    const email = me.data.email ?? "unknown";

    await keytar.setPassword(KEYTAR_SERVICE, refreshKey(email), tokens.refresh_token);
    persistAccount({ email });
    // Re-login may bring a fresh token: drop any stale cached client.
    clients.delete(email);
    log.info("[oauth] account connected", { email });
    return { email };
  } finally {
    server.close();
  }
}

export async function removeAccount(email: string): Promise<void> {
  clients.delete(email);
  await keytar.deletePassword(KEYTAR_SERVICE, refreshKey(email));
  forgetAccount(email);
  invalidate(
    `channels:${email}`,
    `videos:${email}`,
    `video:${email}`,
    `captions:${email}`,
  );
  log.info("[oauth] account removed", { email });
}

/**
 * One-time migration from the single-account layout (one fixed keytar key +
 * email in keytar) to the multi-account layout (token keyed by email, email
 * in settings). Safe to call on every startup — it's a no-op once migrated.
 */
export async function migrateLegacyAccount(): Promise<void> {
  if (getAccounts().length > 0) return;
  const refreshToken = await keytar.getPassword(KEYTAR_SERVICE, LEGACY_REFRESH);
  if (!refreshToken) return;
  const email = (await keytar.getPassword(KEYTAR_SERVICE, LEGACY_EMAIL)) ?? "unknown";

  await keytar.setPassword(KEYTAR_SERVICE, refreshKey(email), refreshToken);
  persistAccount({ email });
  await keytar.deletePassword(KEYTAR_SERVICE, LEGACY_REFRESH);
  await keytar.deletePassword(KEYTAR_SERVICE, LEGACY_EMAIL);
  log.info("[oauth] migrated legacy account", { email });
}

type LoopbackServer = {
  port: number;
  server: http.Server;
  codePromise: Promise<{ code: string; returnedState: string }>;
};

function startLoopbackServer(): Promise<LoopbackServer> {
  return new Promise((resolve, reject) => {
    let resolveCode!: (value: { code: string; returnedState: string }) => void;
    let rejectCode!: (err: Error) => void;
    const codePromise = new Promise<{ code: string; returnedState: string }>((res, rej) => {
      resolveCode = res;
      rejectCode = rej;
    });

    const server = http.createServer((req, res) => {
      if (!req.url) return;
      const url = new URL(req.url, "http://127.0.0.1");
      if (url.pathname !== "/oauth/callback") {
        res.writeHead(404).end();
        return;
      }
      const code = url.searchParams.get("code");
      const returnedState = url.searchParams.get("state") ?? "";
      const error = url.searchParams.get("error");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      if (error || !code) {
        res.end(renderResultPage(false, error ?? "no code returned"));
        rejectCode(new Error(error ?? "OAUTH_NO_CODE"));
        return;
      }
      res.end(renderResultPage(true));
      resolveCode({ code, returnedState });
    });

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address === "object" && address) {
        resolve({ port: address.port, server, codePromise });
      } else {
        reject(new Error("Failed to bind loopback server"));
      }
    });
  });
}

function renderResultPage(ok: boolean, error?: string): string {
  const title = ok ? "Authenticated" : "Authentication failed";
  const body = ok
    ? "You can close this tab and return to YouClicker."
    : `Something went wrong: ${error}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>body{font-family:system-ui;background:#1a1a1a;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
  .card{padding:32px;border:1px solid #E63946;border-radius:12px;text-align:center;max-width:420px}
  h1{margin:0 0 12px;color:#E63946}</style></head>
  <body><div class="card"><h1>${title}</h1><p>${body}</p></div></body></html>`;
}
