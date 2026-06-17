import { describe, it, expect } from "vitest";
import {
  titleDescriptionSchema,
  cueBatchSchema,
  settingsPatchSchema,
  languageCodes,
  parseOrThrow,
} from "../electron/validation";

describe("titleDescriptionSchema", () => {
  it("accepts a well-formed pair", () => {
    expect(titleDescriptionSchema.safeParse({ title: "t", description: "d" }).success).toBe(true);
  });

  it("rejects missing fields or wrong types", () => {
    expect(titleDescriptionSchema.safeParse({ title: "t" }).success).toBe(false);
    expect(titleDescriptionSchema.safeParse({ title: 1, description: "d" }).success).toBe(false);
    expect(titleDescriptionSchema.safeParse(null).success).toBe(false);
  });
});

describe("cueBatchSchema", () => {
  it("accepts an array of {i,t}", () => {
    expect(cueBatchSchema.safeParse([{ i: 0, t: "x" }]).success).toBe(true);
  });

  it("rejects non-integer indices and non-arrays", () => {
    expect(cueBatchSchema.safeParse([{ i: 1.5, t: "x" }]).success).toBe(false);
    expect(cueBatchSchema.safeParse({ i: 0, t: "x" }).success).toBe(false);
  });
});

describe("settingsPatchSchema", () => {
  it("allows partial patches", () => {
    expect(settingsPatchSchema.safeParse({ uiLanguage: "en" }).success).toBe(true);
    expect(settingsPatchSchema.safeParse({}).success).toBe(true);
  });

  it("rejects an unknown UI language", () => {
    expect(settingsPatchSchema.safeParse({ uiLanguage: "xx" }).success).toBe(false);
  });
});

describe("languageCodes", () => {
  it("requires a non-empty array of non-empty strings", () => {
    expect(languageCodes.safeParse(["en", "de"]).success).toBe(true);
    expect(languageCodes.safeParse([]).success).toBe(false);
    expect(languageCodes.safeParse([""]).success).toBe(false);
  });
});

describe("parseOrThrow", () => {
  it("returns parsed data on success", () => {
    expect(parseOrThrow(languageCodes, ["en"], "NO_LANGUAGES_SELECTED")).toEqual(["en"]);
  });

  it("throws the provided code on failure", () => {
    expect(() => parseOrThrow(languageCodes, [], "NO_LANGUAGES_SELECTED")).toThrow(
      "NO_LANGUAGES_SELECTED",
    );
  });
});
