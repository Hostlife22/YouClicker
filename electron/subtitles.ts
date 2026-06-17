import type { SubtitleCue } from "../shared/types";
import { translateCueBatch } from "./translator";
import PQueue from "p-queue";
import log from "electron-log/main";

const BATCH_SIZE = 40;
const CONCURRENCY = 3;

const TIMECODE_RE =
  /^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/;

export function parseSRT(content: string): SubtitleCue[] {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = normalized.split(/\n\n+/);
  const cues: SubtitleCue[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.length > 0);
    if (lines.length < 2) continue;
    let cursor = 0;
    let index: number;
    const maybeIndex = Number.parseInt(lines[cursor] ?? "", 10);
    if (!Number.isNaN(maybeIndex) && TIMECODE_RE.test(lines[cursor + 1] ?? "")) {
      index = maybeIndex;
      cursor += 1;
    } else {
      index = cues.length + 1;
    }
    const tcMatch = TIMECODE_RE.exec(lines[cursor] ?? "");
    if (!tcMatch) continue;
    const startMs = toMs(tcMatch[1]!, tcMatch[2]!, tcMatch[3]!, tcMatch[4]!);
    const endMs = toMs(tcMatch[5]!, tcMatch[6]!, tcMatch[7]!, tcMatch[8]!);
    const text = lines.slice(cursor + 1).join("\n").trim();
    cues.push({ index, startMs, endMs, text });
  }
  return cues;
}

export function serializeSRT(cues: SubtitleCue[]): string {
  return (
    cues
      .map(
        (c, i) =>
          `${i + 1}\n${formatTimestamp(c.startMs)} --> ${formatTimestamp(c.endMs)}\n${c.text}`,
      )
      .join("\n\n") + "\n"
  );
}

function toMs(h: string, m: string, s: string, ms: string): number {
  const hh = Number.parseInt(h, 10);
  const mm = Number.parseInt(m, 10);
  const ss = Number.parseInt(s, 10);
  const mss = Number.parseInt(ms.padEnd(3, "0").slice(0, 3), 10);
  return ((hh * 60 + mm) * 60 + ss) * 1000 + mss;
}

function formatTimestamp(totalMs: number): string {
  const h = Math.floor(totalMs / 3_600_000);
  const m = Math.floor((totalMs % 3_600_000) / 60_000);
  const s = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

export async function translateSRT(
  srt: string,
  sourceLang: string | null,
  targetLang: string,
  onProgress?: (done: number, total: number) => void,
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
  let completedBatches = 0;

  await Promise.all(
    batches.map((batch, i) =>
      queue.add(async () => {
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
        completedBatches += 1;
        onProgress?.(completedBatches, batches.length);
      }),
    ),
  );

  return serializeSRT(translatedBatches.flat());
}
