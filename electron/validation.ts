import { z } from "zod";

/**
 * Schema-based validation at system boundaries: untrusted LLM JSON output and
 * IPC arguments arriving from the renderer. Centralized so the contract for
 * "what shape do we accept" lives in one place.
 */

// --- LLM structured outputs (never trusted; models can drift from the prompt) ---

export const titleDescriptionSchema = z.object({
  title: z.string(),
  description: z.string(),
});

export const cueBatchSchema = z.array(
  z.object({ i: z.number().int(), t: z.string() }),
);

// Manually-edited localizations sent from the renderer (language code -> pair).
export const localizationsSchema = z.record(
  z.object({ title: z.string(), description: z.string() }),
);

// --- IPC inputs from the renderer ---

const UI_LANGUAGE = z.enum(["en", "de", "fr", "uk", "ru"]);

export const settingsPatchSchema = z
  .object({
    uiLanguage: UI_LANGUAGE,
    defaultLanguages: z.array(z.string()),
    googleClientId: z.string().nullable(),
    googleClientSecret: z.string().nullable(),
    accounts: z.array(z.object({ email: z.string() })),
  })
  .partial();

export const nonEmptyString = z.string().min(1);
export const languageCodes = z.array(z.string().min(1)).min(1);

/** Parse with a schema or throw a stable, typed boundary error. */
export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown, code: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(code);
  }
  return result.data;
}
