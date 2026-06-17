import { describe, it, expect } from "vitest";
import {
  estimateQuota,
  exceedsDailyQuota,
  QUOTA_COST,
  DAILY_QUOTA,
} from "../shared/quota";

describe("estimateQuota", () => {
  it("charges a single videos.update for title/description regardless of language count", () => {
    expect(estimateQuota("title_description", 1)).toBe(QUOTA_COST.VIDEOS_UPDATE);
    expect(estimateQuota("title_description", 100)).toBe(QUOTA_COST.VIDEOS_UPDATE);
  });

  it("charges one captions.insert per language for subtitles", () => {
    expect(estimateQuota("subtitles", 0)).toBe(0);
    expect(estimateQuota("subtitles", 3)).toBe(3 * QUOTA_COST.CAPTIONS_INSERT);
  });

  it("clamps negative counts to zero", () => {
    expect(estimateQuota("subtitles", -5)).toBe(0);
  });
});

describe("exceedsDailyQuota", () => {
  it("is false exactly at the daily limit and true just above it", () => {
    const atLimit = DAILY_QUOTA / QUOTA_COST.CAPTIONS_INSERT; // 25 languages = 10000
    expect(exceedsDailyQuota("subtitles", atLimit)).toBe(false);
    expect(exceedsDailyQuota("subtitles", atLimit + 1)).toBe(true);
  });

  it("never trips for title/description (cheap path)", () => {
    expect(exceedsDailyQuota("title_description", 1000)).toBe(false);
  });
});
