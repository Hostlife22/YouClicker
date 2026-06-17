import type { SubtitleCue } from "../shared/types";

/**
 * Pure SRT parsing/serialization. Timecodes are handled here in code and never
 * sent to the translation model — only cue text is. Kept free of any I/O or SDK
 * imports so it can be unit-tested in isolation.
 */

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

export function toMs(h: string, m: string, s: string, ms: string): number {
  const hh = Number.parseInt(h, 10);
  const mm = Number.parseInt(m, 10);
  const ss = Number.parseInt(s, 10);
  const mss = Number.parseInt(ms.padEnd(3, "0").slice(0, 3), 10);
  return ((hh * 60 + mm) * 60 + ss) * 1000 + mss;
}

export function formatTimestamp(totalMs: number): string {
  const h = Math.floor(totalMs / 3_600_000);
  const m = Math.floor((totalMs % 3_600_000) / 60_000);
  const s = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}
