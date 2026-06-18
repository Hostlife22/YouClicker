import type { Localization, Localizations } from "./types";

/**
 * Hard limits YouTube enforces on localized video metadata. `videos.update` is
 * all-or-nothing: a single field over the limit (or containing a forbidden
 * character) rejects the entire request with `invalidVideoMetadata`, so every
 * localization must be brought within these bounds before upload.
 * See https://developers.google.com/youtube/v3/docs/videos#properties
 */
export const YOUTUBE_LIMITS = {
  /** Max length of a localized title, in characters. */
  TITLE_MAX: 100,
  /** Max length of a localized description, in characters. */
  DESCRIPTION_MAX: 5000,
} as const;

/** Characters YouTube rejects anywhere in a title or description. */
const FORBIDDEN_CHARS = /[<>]/g;

/**
 * Truncate to at most `max` characters (counted by code point so multi-byte
 * scripts aren't split mid-character). Prefer cutting at the last whitespace so
 * a word isn't sliced in half; for scripts without spaces (e.g. CJK) fall back
 * to a hard cut.
 */
function truncate(text: string, max: number): string {
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  const slice = chars.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
  return cut.join("").trimEnd();
}

/**
 * Bring a single localization within YouTube's limits without throwing: strip
 * forbidden characters and truncate over-long fields. Returns the safe value
 * plus a human-readable list of every adjustment made (empty when untouched).
 */
export function sanitizeLocalization(loc: Localization): {
  value: Localization;
  issues: string[];
} {
  const issues: string[] = [];

  let title = loc.title.replace(FORBIDDEN_CHARS, "");
  if (title !== loc.title) issues.push("title: removed '<'/'>' characters");
  if (Array.from(title).length > YOUTUBE_LIMITS.TITLE_MAX) {
    title = truncate(title, YOUTUBE_LIMITS.TITLE_MAX);
    issues.push(`title: truncated to ${YOUTUBE_LIMITS.TITLE_MAX} characters`);
  }

  let description = loc.description.replace(FORBIDDEN_CHARS, "");
  if (description !== loc.description) {
    issues.push("description: removed '<'/'>' characters");
  }
  if (Array.from(description).length > YOUTUBE_LIMITS.DESCRIPTION_MAX) {
    description = truncate(description, YOUTUBE_LIMITS.DESCRIPTION_MAX);
    issues.push(`description: truncated to ${YOUTUBE_LIMITS.DESCRIPTION_MAX} characters`);
  }

  return { value: { title, description }, issues };
}

/**
 * Sanitize every entry of a localizations map. Returns a new map (no mutation)
 * and the per-language issues, keyed by language code, for entries that needed
 * adjustment.
 */
export function sanitizeLocalizations(map: Localizations): {
  value: Localizations;
  issues: Record<string, string[]>;
} {
  const value: Localizations = {};
  const issues: Record<string, string[]> = {};
  for (const [lang, loc] of Object.entries(map)) {
    const result = sanitizeLocalization(loc);
    value[lang] = result.value;
    if (result.issues.length > 0) issues[lang] = result.issues;
  }
  return { value, issues };
}
