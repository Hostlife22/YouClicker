import type { TranslationStep } from "./types";

/**
 * Approximate YouTube Data API v3 quota costs (units) for the write operations
 * this app performs. Reads are ~1 unit each and ignored in estimates.
 * See https://developers.google.com/youtube/v3/determine_quota_cost
 */
export const QUOTA_COST = {
  VIDEOS_UPDATE: 50,
  CAPTIONS_INSERT: 400,
} as const;

/** Default daily quota for a fresh Google Cloud project. */
export const DAILY_QUOTA = 10_000;

/**
 * Upper-bound estimate of the quota a translation job will consume.
 * Title/description localizations are merged into a single `videos.update`
 * regardless of language count; subtitles insert one caption track per target
 * language (the source language is skipped at run time, so this over-estimates
 * by at most one track).
 */
export function estimateQuota(step: TranslationStep, languageCount: number): number {
  const count = Math.max(0, languageCount);
  return step === "title_description"
    ? QUOTA_COST.VIDEOS_UPDATE
    : count * QUOTA_COST.CAPTIONS_INSERT;
}

/** True when a job's estimated cost exceeds the default daily quota. */
export function exceedsDailyQuota(step: TranslationStep, languageCount: number): boolean {
  return estimateQuota(step, languageCount) > DAILY_QUOTA;
}
