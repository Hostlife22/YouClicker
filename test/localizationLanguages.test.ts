import { describe, it, expect } from "vitest";
import { pickSupportedLocalizations } from "../shared/localizationLanguages";

const loc = (t: string) => ({ title: t, description: t });

describe("pickSupportedLocalizations", () => {
  const supported = ["en", "de", "fr", "zh-Hans", "iw", "fil"];

  it("keeps known codes and separates the rest as extras", () => {
    const { value, dropped } = pickSupportedLocalizations(
      { en: loc("a"), tlh: loc("b"), eo: loc("c") },
      supported,
    );
    expect(Object.keys(value)).toEqual(["en"]);
    expect(dropped).toEqual(["tlh", "eo"]);
  });

  it("normalizes to the canonical spelling (case-insensitive)", () => {
    const { value } = pickSupportedLocalizations({ "zh-hans": loc("x") }, supported);
    expect(value["zh-Hans"]).toEqual(loc("x"));
    expect(value["zh-hans"]).toBeUndefined();
  });

  it("matches exact YouTube codes verbatim (no aliasing)", () => {
    const { value, dropped } = pickSupportedLocalizations(
      { iw: loc("h"), fil: loc("f"), tl: loc("t") },
      supported,
    );
    expect(value.iw).toEqual(loc("h"));
    expect(value.fil).toEqual(loc("f"));
    // `tl` is a distinct code not in the known set → an extra, not aliased to fil
    expect(value.tl).toBeUndefined();
    expect(dropped).toEqual(["tl"]);
  });

  it("does not mutate the input map", () => {
    const input = { en: loc("a"), tlh: loc("b") };
    pickSupportedLocalizations(input, supported);
    expect(Object.keys(input)).toEqual(["en", "tlh"]);
  });
});
