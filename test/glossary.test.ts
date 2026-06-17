import { describe, it, expect } from "vitest";
import { buildGlossaryInstruction } from "../electron/glossary";

describe("buildGlossaryInstruction", () => {
  it("returns an empty string for an empty glossary", () => {
    expect(buildGlossaryInstruction([])).toBe("");
  });

  it("ignores entries with a blank term", () => {
    expect(buildGlossaryInstruction([{ term: "  ", translation: "x" }])).toBe("");
  });

  it("lists verbatim terms (empty translation)", () => {
    const out = buildGlossaryInstruction([
      { term: "YouClicker", translation: "" },
      { term: "MrBeast", translation: "  " },
    ]);
    expect(out).toContain("do not translate");
    expect(out).toContain("YouClicker, MrBeast");
    expect(out).not.toContain("->");
  });

  it("lists fixed renderings (non-empty translation)", () => {
    const out = buildGlossaryInstruction([{ term: "cloud", translation: "облако" }]);
    expect(out).toContain('"cloud" -> "облако"');
  });

  it("combines both kinds and trims whitespace", () => {
    const out = buildGlossaryInstruction([
      { term: " Brand ", translation: "" },
      { term: " API ", translation: " API " },
    ]);
    expect(out).toContain("Brand");
    expect(out).toContain('"API" -> "API"');
    expect(out.startsWith("\n")).toBe(true);
  });
});
