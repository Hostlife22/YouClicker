import type { Api } from "@shared/api";

declare global {
  interface Window {
    api: Api;
  }
}

export const api = (): Api => window.api;
