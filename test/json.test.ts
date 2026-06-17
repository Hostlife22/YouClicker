import { describe, it, expect } from "vitest";
import { stripJsonFences } from "../electron/json";

describe("stripJsonFences", () => {
  it("returns plain JSON untouched", () => {
    expect(stripJsonFences('{"a":1}')).toBe('{"a":1}');
  });

  it("strips a ```json fence", () => {
    expect(stripJsonFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("strips a bare ``` fence", () => {
    expect(stripJsonFences('```\n[1,2,3]\n```')).toBe("[1,2,3]");
  });

  it("trims surrounding whitespace", () => {
    expect(stripJsonFences('   {"a":1}   ')).toBe('{"a":1}');
  });

  it("leaves fenceless content with internal backticks alone", () => {
    expect(stripJsonFences('{"code":"`x`"}')).toBe('{"code":"`x`"}');
  });
});
