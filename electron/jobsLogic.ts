import type { TranslationJob } from "../shared/types";

/** Cap on how many finished jobs the history keeps. */
export const MAX_JOBS = 50;

/** Most-recent-first by start time (immutable). */
export function sortByRecent(jobs: TranslationJob[]): TranslationJob[] {
  return [...jobs].sort((a, b) => b.startedAt - a.startedAt);
}

/** Insert a job, or replace an existing one with the same id (immutable). */
export function upsertJob(
  jobs: TranslationJob[],
  job: TranslationJob,
): TranslationJob[] {
  return [job, ...jobs.filter((j) => j.id !== job.id)];
}

/** Keep only the most recent `max` jobs. */
export function capJobs(
  jobs: TranslationJob[],
  max: number = MAX_JOBS,
): TranslationJob[] {
  return sortByRecent(jobs).slice(0, max);
}
