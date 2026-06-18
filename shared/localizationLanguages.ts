import type { Localizations } from "./types";

/**
 * Split a localizations map into the codes YouTube is known to accept (its
 * `i18nLanguages` set, matched case-insensitively and normalized to YouTube's
 * canonical spelling) and the rest. Used by the adaptive upload as the
 * "known-good" base: known codes go up in one request, the rest are probed
 * individually. `supportedCodes` is the list returned by `i18nLanguages.list`.
 */
export function pickSupportedLocalizations(
  map: Localizations,
  supportedCodes: string[],
): { value: Localizations; dropped: string[] } {
  const canonical = new Map<string, string>();
  for (const code of supportedCodes) canonical.set(code.toLowerCase(), code);

  const value: Localizations = {};
  const dropped: string[] = [];
  for (const [code, loc] of Object.entries(map)) {
    const hit = canonical.get(code.toLowerCase());
    if (hit) value[hit] = loc;
    else dropped.push(code);
  }
  return { value, dropped };
}
