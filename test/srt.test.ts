import { describe, it, expect } from "vitest";
import { parseSRT, serializeSRT, toMs, formatTimestamp } from "../electron/srt";

const SAMPLE = `1
00:00:01,000 --> 00:00:04,000
Hello world

2
00:00:05,500 --> 00:00:08,250
Second line
spanning two rows`;

describe("toMs / formatTimestamp", () => {
  it("converts components to milliseconds", () => {
    expect(toMs("01", "02", "03", "004")).toBe(((1 * 60 + 2) * 60 + 3) * 1000 + 4);
  });

  it("pads short millisecond fields to three digits", () => {
    expect(toMs("0", "0", "0", "5")).toBe(500);
  });

  it("round-trips through formatTimestamp", () => {
    const ms = toMs("01", "02", "03", "456");
    expect(formatTimestamp(ms)).toBe("01:02:03,456");
  });
});

describe("parseSRT", () => {
  it("parses indexed cues with timecodes and multi-line text", () => {
    const cues = parseSRT(SAMPLE);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toEqual({
      index: 1,
      startMs: 1000,
      endMs: 4000,
      text: "Hello world",
    });
    expect(cues[1]?.text).toBe("Second line\nspanning two rows");
    expect(cues[1]?.startMs).toBe(5500);
  });

  it("normalizes CRLF line endings", () => {
    const cues = parseSRT(SAMPLE.replace(/\n/g, "\r\n"));
    expect(cues).toHaveLength(2);
    expect(cues[0]?.text).toBe("Hello world");
  });

  it("falls back to positional indices when the index line is missing", () => {
    const noIndex = `00:00:01,000 --> 00:00:02,000
First`;
    const cues = parseSRT(noIndex);
    expect(cues[0]?.index).toBe(1);
    expect(cues[0]?.text).toBe("First");
  });

  it("returns no cues for empty input", () => {
    expect(parseSRT("")).toEqual([]);
  });
});

describe("serializeSRT", () => {
  it("renumbers sequentially and ends with a trailing newline", () => {
    const out = serializeSRT([
      { index: 9, startMs: 1000, endMs: 2000, text: "A" },
      { index: 4, startMs: 3000, endMs: 4000, text: "B" },
    ]);
    expect(out).toBe(
      "1\n00:00:01,000 --> 00:00:02,000\nA\n\n2\n00:00:03,000 --> 00:00:04,000\nB\n",
    );
  });

  it("round-trips parse -> serialize -> parse", () => {
    const once = parseSRT(SAMPLE);
    const twice = parseSRT(serializeSRT(once));
    expect(twice.map((c) => c.text)).toEqual(once.map((c) => c.text));
    expect(twice.map((c) => c.startMs)).toEqual(once.map((c) => c.startMs));
  });
});
