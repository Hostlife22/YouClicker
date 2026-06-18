import { describe, it, expect } from "vitest";
import {
  YOUTUBE_LIMITS,
  sanitizeLocalization,
  sanitizeLocalizations,
} from "../shared/localizationLimits";

describe("sanitizeLocalization", () => {
  it("leaves a within-limits localization untouched", () => {
    const loc = { title: "Hello", description: "World" };
    const { value, issues } = sanitizeLocalization(loc);
    expect(value).toEqual(loc);
    expect(issues).toEqual([]);
  });

  it("strips forbidden angle brackets", () => {
    const { value, issues } = sanitizeLocalization({
      title: "a < b > c",
      description: "x <y> z",
    });
    expect(value.title).toBe("a  b  c");
    expect(value.description).toBe("x y z");
    expect(issues).toContain("title: removed '<'/'>' characters");
    expect(issues).toContain("description: removed '<'/'>' characters");
  });

  it("truncates an over-long title at a word boundary", () => {
    const title = "word ".repeat(40).trim(); // 199 chars, spaced
    const { value, issues } = sanitizeLocalization({ title, description: "" });
    expect(Array.from(value.title).length).toBeLessThanOrEqual(YOUTUBE_LIMITS.TITLE_MAX);
    expect(value.title.endsWith("word")).toBe(true); // no half-word
    expect(issues).toContain(`title: truncated to ${YOUTUBE_LIMITS.TITLE_MAX} characters`);
  });

  it("hard-truncates space-less scripts to the limit", () => {
    const title = "あ".repeat(150);
    const { value } = sanitizeLocalization({ title, description: "" });
    expect(Array.from(value.title).length).toBe(YOUTUBE_LIMITS.TITLE_MAX);
  });

  it("truncates an over-long description", () => {
    const description = "x".repeat(YOUTUBE_LIMITS.DESCRIPTION_MAX + 500);
    const { value, issues } = sanitizeLocalization({ title: "t", description });
    expect(Array.from(value.description).length).toBeLessThanOrEqual(
      YOUTUBE_LIMITS.DESCRIPTION_MAX,
    );
    expect(issues).toContain(
      `description: truncated to ${YOUTUBE_LIMITS.DESCRIPTION_MAX} characters`,
    );
  });

  it("counts by code point, never splitting a multi-byte character", () => {
    const title = "😀".repeat(150);
    const { value } = sanitizeLocalization({ title, description: "" });
    const chars = Array.from(value.title);
    expect(chars.length).toBe(YOUTUBE_LIMITS.TITLE_MAX);
    expect(chars.every((c) => c === "😀")).toBe(true);
  });
});

describe("sanitizeLocalizations", () => {
  it("sanitizes every entry and reports per-language issues", () => {
    const { value, issues } = sanitizeLocalizations({
      en: { title: "fine", description: "ok" },
      de: { title: "bad < title", description: "d" },
    });
    expect(value.en).toEqual({ title: "fine", description: "ok" });
    expect(value.de!.title).toBe("bad  title");
    expect(issues.en).toBeUndefined();
    expect(issues.de).toContain("title: removed '<'/'>' characters");
  });

  it("does not mutate the input map", () => {
    const input = { en: { title: "a<b", description: "c" } };
    sanitizeLocalizations(input);
    expect(input.en.title).toBe("a<b");
  });
});
