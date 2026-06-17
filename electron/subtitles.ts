import type { SubtitleCue } from "../shared/types";
import { translateCueBatch } from "./translator";
import { parseSRT, serializeSRT } from "./srt";
import PQueue from "p-queue";
import log from "electron-log/main";

const BATCH_SIZE = 40;
const CONCURRENCY = 3;

export { parseSRT, serializeSRT } from "./srt";

export async function translateSRT(
  srt: string,
  sourceLang: string | null,
  targetLang: string,
): Promise<string> {
  const cues = parseSRT(srt);
  if (cues.length === 0) return srt;
  const batches: SubtitleCue[][] = [];
  for (let i = 0; i < cues.length; i += BATCH_SIZE) {
    batches.push(cues.slice(i, i + BATCH_SIZE));
  }
  log.info("[subtitles] translating", {
    cueCount: cues.length,
    batches: batches.length,
    targetLang,
  });

  const queue = new PQueue({ concurrency: CONCURRENCY });
  const translatedBatches: SubtitleCue[][] = new Array(batches.length);

  await Promise.all(
    batches.map((batch, i) =>
      queue.add(async () => {
        // translateCueBatch returns one entry per input cue, keyed by index,
        // so we remap defensively rather than trusting array order.
        const result = await translateCueBatch(
          batch.map((c) => ({ index: c.index, text: c.text })),
          sourceLang,
          targetLang,
        );
        const byIndex = new Map(result.map((r) => [r.index, r.text]));
        translatedBatches[i] = batch.map((c) => ({
          ...c,
          text: byIndex.get(c.index) ?? c.text,
        }));
      }),
    ),
  );

  return serializeSRT(translatedBatches.flat());
}
