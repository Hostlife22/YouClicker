import { query } from "@anthropic-ai/claude-agent-sdk";
import { findLanguage } from "../shared/languages";
import type { Localization } from "../shared/types";
import log from "electron-log/main";

type AssistantContentBlock = { type: string; text?: string };

async function runClaude(prompt: string, system: string): Promise<string> {
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
  const result = await runClaude(prompt, TRANSLATE_SYSTEM);
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
{"title": "<translated title>", "description": "<translated description>"}`;

  const prompt = `Translate the YouTube video title and description from ${sourceLabel} into ${languageLabel(targetLang)} (${targetLang}).

<title>${title}</title>
<description>
${description}
</description>

Respond with JSON only.`;

  const raw = await runClaude(prompt, system);
  const cleaned = stripJsonFences(raw);
  try {
    const parsed = JSON.parse(cleaned) as { title?: string; description?: string };
    return {
      title: (parsed.title ?? "").trim() || title,
      description: (parsed.description ?? "").trim() || description,
    };
  } catch (err) {
    log.warn("[translator] JSON parse failed, falling back to two-shot", {
      targetLang,
      err: String(err),
    });
    const [t, d] = await Promise.all([
      translateText(title, sourceLang, targetLang),
      translateText(description, sourceLang, targetLang),
    ]);
    return { title: t || title, description: d || description };
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

  const raw = await runClaude(prompt, CUE_SYSTEM);
  const cleaned = stripJsonFences(raw);
  let parsed: { i: number; t: string }[];
  try {
    parsed = JSON.parse(cleaned) as { i: number; t: string }[];
  } catch (err) {
    log.error("[translator] cue batch JSON parse failed", {
      targetLang,
      err: String(err),
      sample: cleaned.slice(0, 200),
    });
    throw new Error("CUE_TRANSLATION_PARSE_FAILED");
  }
  const byIndex = new Map(parsed.map((p) => [p.i, p.t]));
  return cues.map((c) => ({
    index: c.index,
    text: byIndex.get(c.index) ?? c.text,
  }));
}

function stripJsonFences(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/```$/g, "").trim();
  }
  return t;
}
