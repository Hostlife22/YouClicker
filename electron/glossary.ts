import type { GlossaryEntry } from "../shared/types";

/**
 * Build the glossary clause appended to a translation system prompt. Terms with
 * an empty `translation` are kept verbatim; terms with one are always rendered
 * the specified way. Returns "" when there is nothing to enforce. Pure, so it
 * can be unit-tested without the Claude SDK or settings store.
 */
export function buildGlossaryInstruction(glossary: GlossaryEntry[]): string {
  const keepVerbatim = glossary
    .filter((g) => g.term.trim() && !g.translation.trim())
    .map((g) => g.term.trim());
  const fixedRenderings = glossary.filter(
    (g) => g.term.trim() && g.translation.trim(),
  );

  if (keepVerbatim.length === 0 && fixedRenderings.length === 0) return "";

  const lines = ["", "Glossary rules (apply to every language):"];
  if (keepVerbatim.length > 0) {
    lines.push(
      `- Keep these terms EXACTLY as written, do not translate them: ${keepVerbatim.join(", ")}.`,
    );
  }
  if (fixedRenderings.length > 0) {
    const pairs = fixedRenderings
      .map((g) => `"${g.term.trim()}" -> "${g.translation.trim()}"`)
      .join(", ");
    lines.push(`- Always render these terms exactly as specified: ${pairs}.`);
  }
  return lines.join("\n");
}
