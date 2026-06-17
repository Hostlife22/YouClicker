type Translate = (key: string, options?: { defaultValue: string }) => string;

/**
 * Map an IPC error code (e.g. `NOT_AUTHENTICATED`) to a localized message,
 * falling back to the raw code when no `errors.<code>` translation exists.
 */
export function errorText(t: Translate, code: string): string {
  return t(`errors.${code}`, { defaultValue: code });
}
