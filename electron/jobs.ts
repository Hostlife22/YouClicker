import Store from "electron-store";
import type { TranslationJob, JobStatus, TranslationStep } from "../shared/types";
import { upsertJob, capJobs } from "./jobsLogic";

/**
 * Persisted history of translation runs (non-secret), so past jobs survive an
 * app restart. Capped to the most recent MAX_JOBS entries.
 */
type JobsShape = { jobs: TranslationJob[] };

const store = new Store<JobsShape>({
  name: "youclicker-jobs",
  defaults: { jobs: [] },
});

export function listJobs(): TranslationJob[] {
  return capJobs(store.get("jobs"));
}

export function recordJobStart(input: {
  id: string;
  videoId: string;
  videoTitle: string;
  step: TranslationStep;
  targetLanguages: string[];
  startedAt: number;
}): void {
  const job: TranslationJob = {
    ...input,
    status: "running",
    updated: [],
    failed: [],
    skipped: [],
    finishedAt: null,
    error: null,
  };
  store.set("jobs", capJobs(upsertJob(store.get("jobs"), job)));
}

export function recordJobFinish(
  id: string,
  patch: {
    status: JobStatus;
    updated?: string[];
    failed?: string[];
    skipped?: string[];
    error?: string | null;
    finishedAt: number;
  },
): void {
  const jobs = store.get("jobs");
  const existing = jobs.find((j) => j.id === id);
  if (!existing) return;
  const next: TranslationJob = {
    ...existing,
    status: patch.status,
    updated: patch.updated ?? existing.updated,
    failed: patch.failed ?? existing.failed,
    skipped: patch.skipped ?? existing.skipped,
    error: patch.error ?? null,
    finishedAt: patch.finishedAt,
  };
  store.set("jobs", capJobs(upsertJob(jobs, next)));
}

export function clearJobs(): void {
  store.set("jobs", []);
}
