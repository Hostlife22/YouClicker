import Store from "electron-store";
import type { Settings, Account } from "../shared/types";

const DEFAULTS: Settings = {
  uiLanguage: "ru",
  defaultLanguages: ["en", "de", "fr", "es", "it"],
  googleClientId: null,
  googleClientSecret: null,
  accounts: [],
  glossary: [],
};

const store = new Store<Settings>({
  name: "youclicker-settings",
  defaults: DEFAULTS,
  schema: {
    uiLanguage: { type: "string", enum: ["en", "de", "fr", "uk", "ru"] },
    defaultLanguages: { type: "array", items: { type: "string" } },
    googleClientId: { type: ["string", "null"] },
    googleClientSecret: { type: ["string", "null"] },
    accounts: {
      type: "array",
      items: {
        type: "object",
        properties: { email: { type: "string" } },
        required: ["email"],
      },
    },
    glossary: {
      type: "array",
      items: {
        type: "object",
        properties: {
          term: { type: "string" },
          translation: { type: "string" },
        },
        required: ["term", "translation"],
      },
    },
  },
});

export function getSettings(): Settings {
  return {
    uiLanguage: store.get("uiLanguage"),
    defaultLanguages: store.get("defaultLanguages"),
    googleClientId: store.get("googleClientId"),
    googleClientSecret: store.get("googleClientSecret"),
    accounts: store.get("accounts"),
    glossary: store.get("glossary"),
  };
}

export function getAccounts(): Account[] {
  return store.get("accounts");
}

/** Add an account if its email isn't already present (idempotent re-login). */
export function addAccount(account: Account): Account[] {
  const existing = store.get("accounts");
  if (existing.some((a) => a.email === account.email)) return existing;
  const next = [...existing, account];
  store.set("accounts", next);
  return next;
}

export function removeAccount(email: string): Account[] {
  const next = store.get("accounts").filter((a) => a.email !== email);
  store.set("accounts", next);
  return next;
}

export function updateSettings(patch: Partial<Settings>): Settings {
  for (const [key, value] of Object.entries(patch)) {
    store.set(key as keyof Settings, value as never);
  }
  return getSettings();
}
