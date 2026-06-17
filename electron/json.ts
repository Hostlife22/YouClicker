/**
 * Strip a leading/trailing Markdown code fence from an LLM response so the
 * inner JSON can be parsed. Models sometimes wrap JSON in ```json … ``` despite
 * being told not to. Pure and dependency-free so it can be unit-tested in
 * isolation (no Claude SDK import).
 */
export function stripJsonFences(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/```$/g, "").trim();
  }
  return t;
}
