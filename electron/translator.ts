import { query } from "@anthropic-ai/claude-agent-sdk";
import { findLanguage } from "../shared/languages";
import type { Localization } from "../shared/types";
import { stripJsonFences } from "./json";
import { titleDescriptionSchema, cueBatchSchema, localizationsSchema } from "./validation";
import { YOUTUBE_LIMITS } from "../shared/localizationLimits";
import { withRetry } from "./retry";
import { buildGlossaryInstruction } from "./glossary";
import { getSettings } from "./store";
import log from "electron-log/main";

/** Current glossary clause from settings, appended to translation prompts. */
function glossaryClause(): string {
  return buildGlossaryInstruction(getSettings().glossary ?? []);
}

type AssistantContentBlock = { type: string; text?: string };

async function runClaude(prompt: string, system: string): Promise<string> {
  return withRetry(
    async () => {
      let output = "";
      const stream = query({
        prompt,
        options: {
          model: "claude-haiku-4-5-20251001",
          permissionMode: "bypassPermissions",
          systemPrompt: system,
          allowedTools: [],
          maxTurns: 1,
        },
      });
      for await (const msg of stream) {
        if (msg.type === "assistant") {
          const content = (msg.message as { content?: AssistantContentBlock[] })
            .content;
          for (const block of content ?? []) {
            if (block.type === "text" && block.text) {
              output += block.text;
            }
          }
        }
      }
      return output.trim();
    },
    { label: "claude" },
  );
}

function languageLabel(code: string): string {
  return findLanguage(code)?.name ?? code;
}

const TRANSLATE_SYSTEM = `You are a professional YouTube content translator.
Strict output rules:
- Output ONLY the translation, no preamble, no explanations, no quotes around the result, no markdown fences.
- Preserve emojis, hashtags, @mentions, URLs and timestamps EXACTLY as they appear.
- Keep line breaks and paragraph structure intact.
- Do not invent links or hashtags that were not in the source.
- Natural, idiomatic style for the target language — not a word-by-word machine translation.`;

export async function translateText(
  text: string,
  sourceLang: string | null,
  targetLang: string,
): Promise<string> {
  if (!text.trim()) return "";
  const sourceLabel = sourceLang ? languageLabel(sourceLang) : "the source language (auto-detect)";
  const prompt = `Translate the following YouTube text from ${sourceLabel} into ${languageLabel(targetLang)} (ISO code: ${targetLang}).

<source>
${text}
</source>`;
  const result = await runClaude(prompt, TRANSLATE_SYSTEM + glossaryClause());
  return result;
}

export async function translateTitleAndDescription(
  title: string,
  description: string,
  sourceLang: string | null,
  targetLang: string,
): Promise<Localization> {
  const sourceLabel = sourceLang ? languageLabel(sourceLang) : "the source language (auto-detect)";
  const system = `${TRANSLATE_SYSTEM}

You must respond with valid JSON only. No prose, no markdown fences. Schema:
{"title": "...translated title...", "description": "...translated description..."}

YouTube field limits — you MUST obey these or the upload is rejected:
- "title": at most ${YOUTUBE_LIMITS.TITLE_MAX} characters. If a faithful translation would be longer, shorten it while keeping the meaning.
- "description": at most ${YOUTUBE_LIMITS.DESCRIPTION_MAX} characters.
- Never use the "<" or ">" characters anywhere in "title" or "description".${glossaryClause()}`;

  const prompt = `Translate the YouTube video title and description from ${sourceLabel} into ${languageLabel(targetLang)} (${targetLang}).

<title>${title}</title>
<description>
${description}
</description>

Respond with JSON only.`;

  const raw = await runClaude(prompt, system);
  const parsed = titleDescriptionSchema.safeParse(safeJsonParse(stripJsonFences(raw)));
  if (parsed.success) {
    return {
      title: parsed.data.title.trim() || title,
      description: parsed.data.description.trim() || description,
    };
  }
  log.warn("[translator] title/desc JSON invalid, falling back to two-shot", {
    targetLang,
    issues: parsed.error.issues.map((i) => i.message),
  });
  const [t, d] = await Promise.all([
    translateText(title, sourceLang, targetLang),
    translateText(description, sourceLang, targetLang),
  ]);
  return { title: t || title, description: d || description };
}

/**
 * Translate the title and description into MANY target languages in a single
 * Claude call (one CLI spawn instead of one per language — the dominant cost
 * when localizing into 100+ languages). The model returns a JSON object keyed
 * by ISO code; only requested codes with usable content are kept. Languages the
 * model drops or mangles are simply absent from the result — the caller is
 * expected to fall back to per-language translation for those.
 */
export async function translateTitleAndDescriptionBatch(
  title: string,
  description: string,
  sourceLang: string | null,
  targetLangs: string[],
): Promise<Record<string, Localization>> {
  if (targetLangs.length === 0) return {};
  const sourceLabel = sourceLang
    ? languageLabel(sourceLang)
    : "the source language (auto-detect)";
  const langList = targetLangs
    .map((code) => `- "${code}": ${languageLabel(code)}`)
    .join("\n");

  const system = `${TRANSLATE_SYSTEM}

You translate into MULTIPLE target languages at once. Respond with valid JSON only — no prose, no markdown fences. The JSON is one object whose keys are the exact ISO codes given, each mapping to a translated pair:
{"<code>": {"title": "...", "description": "..."}}
Include every requested code exactly once, using the code verbatim as the key.

YouTube field limits — you MUST obey these for every language or the upload is rejected:
- "title": at most ${YOUTUBE_LIMITS.TITLE_MAX} characters. Shorten if a faithful translation would be longer.
- "description": at most ${YOUTUBE_LIMITS.DESCRIPTION_MAX} characters.
- Never use the "<" or ">" characters anywhere in "title" or "description".${glossaryClause()}`;

  const prompt = `Translate the YouTube video title and description from ${sourceLabel} into these ${targetLangs.length} target languages (key the output by the ISO code shown):
${langList}

<title>${title}</title>
<description>
${description}
</description>

Respond with a single JSON object keyed by ISO code, containing all ${targetLangs.length} codes.`;

  const raw = await runClaude(prompt, system);
  const parsed = localizationsSchema.safeParse(safeJsonParse(stripJsonFences(raw)));
  if (!parsed.success) {
    log.warn("[translator] batch title/desc JSON invalid, languages will fall back", {
      count: targetLangs.length,
      issues: parsed.error.issues.slice(0, 3).map((i) => i.message),
    });
    return {};
  }

  const out: Record<string, Localization> = {};
  for (const code of targetLangs) {
    const loc = parsed.data[code];
    if (loc && (loc.title.trim() || loc.description.trim())) {
      out[code] = {
        title: loc.title.trim() || title,
        description: loc.description.trim() || description,
      };
    }
  }
  return out;
}

/** Parse JSON without throwing; returns `null` on malformed input. */
function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const CUE_SYSTEM = `You are a professional subtitle translator.
You will receive a JSON array of subtitle lines, each {"i": index, "t": text}.
Translate the "t" field of each line.
Strict output rules:
- Output a JSON array with the same length and same "i" values, only "t" translated.
- Preserve emojis, punctuation, brackets like [music], (laughs), and speaker labels.
- Keep translated lines natural and not too long — viewers read them on screen.
- Do NOT merge or split lines. One input line → one output line.
- Output JSON only, no markdown fences, no prose.`;

export async function translateCueBatch(
  cues: { index: number; text: string }[],
  sourceLang: string | null,
  targetLang: string,
): Promise<{ index: number; text: string }[]> {
  if (cues.length === 0) return [];
  const sourceLabel = sourceLang ? languageLabel(sourceLang) : "the source language (auto-detect)";
  const payload = JSON.stringify(
    cues.map((c) => ({ i: c.index, t: c.text })),
  );
  const prompt = `Translate the following subtitle lines from ${sourceLabel} into ${languageLabel(targetLang)} (${targetLang}).

${payload}`;

  const raw = await runClaude(prompt, CUE_SYSTEM + glossaryClause());
  const cleaned = stripJsonFences(raw);
  const parsed = cueBatchSchema.safeParse(safeJsonParse(cleaned));
  if (!parsed.success) {
    log.error("[translator] cue batch JSON invalid", {
      targetLang,
      issues: parsed.error.issues.map((i) => i.message),
      sample: cleaned.slice(0, 200),
    });
    throw new Error("CUE_TRANSLATION_PARSE_FAILED");
  }
  const byIndex = new Map(parsed.data.map((p) => [p.i, p.t]));
  return cues.map((c) => ({
    index: c.index,
    text: byIndex.get(c.index) ?? c.text,
  }));
}
