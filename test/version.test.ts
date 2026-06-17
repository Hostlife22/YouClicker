import { describe, it, expect } from "vitest";
import { parseVersion, isNewer } from "../electron/version";

describe("parseVersion", () => {
  it("parses major.minor.patch and strips a leading v", () => {
    expect(parseVersion("v1.2.3")).toEqual([1, 2, 3]);
    expect(parseVersion("1.2.3")).toEqual([1, 2, 3]);
  });

  it("defaults missing parts to zero and ignores pre-release metadata", () => {
    expect(parseVersion("2")).toEqual([2, 0, 0]);
    expect(parseVersion("1.4")).toEqual([1, 4, 0]);
    expect(parseVersion("1.2.3-beta.1")).toEqual([1, 2, 3]);
  });
});

describe("isNewer", () => {
  it("detects a higher version at each component", () => {
    expect(isNewer("1.0.1", "1.0.0")).toBe(true);
    expect(isNewer("1.1.0", "1.0.9")).toBe(true);
    expect(isNewer("2.0.0", "1.9.9")).toBe(true);
  });

  it("is false for equal or older versions", () => {
    expect(isNewer("1.0.0", "1.0.0")).toBe(false);
    expect(isNewer("1.0.0", "1.0.1")).toBe(false);
    expect(isNewer("1.0.0", "2.0.0")).toBe(false);
  });

  it("handles a leading v on either side", () => {
    expect(isNewer("v1.2.0", "1.1.0")).toBe(true);
    expect(isNewer("1.2.0", "v1.2.0")).toBe(false);
  });
});
