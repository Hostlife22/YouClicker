import { describe, it, expect } from "vitest";
import { sortByRecent, upsertJob, capJobs } from "../electron/jobsLogic";
import type { TranslationJob } from "../shared/types";

function job(id: string, startedAt: number): TranslationJob {
  return {
    id,
    videoId: "v" + id,
    videoTitle: "Video " + id,
    step: "subtitles",
    targetLanguages: ["en"],
    status: "completed",
    updated: ["en"],
    failed: [],
    skipped: [],
    startedAt,
    finishedAt: startedAt + 1,
    error: null,
  };
}

describe("sortByRecent", () => {
  it("orders by startedAt descending without mutating the input", () => {
    const input = [job("a", 1), job("b", 3), job("c", 2)];
    const out = sortByRecent(input);
    expect(out.map((j) => j.id)).toEqual(["b", "c", "a"]);
    expect(input.map((j) => j.id)).toEqual(["a", "b", "c"]);
  });
});

describe("upsertJob", () => {
  it("prepends a new job", () => {
    const out = upsertJob([job("a", 1)], job("b", 2));
    expect(out.map((j) => j.id)).toEqual(["b", "a"]);
  });

  it("replaces a job with the same id instead of duplicating", () => {
    const running = { ...job("a", 1), status: "running" as const };
    const finished = { ...job("a", 1), status: "completed" as const };
    const out = upsertJob([running, job("b", 2)], finished);
    expect(out).toHaveLength(2);
    expect(out.find((j) => j.id === "a")?.status).toBe("completed");
  });
});

describe("capJobs", () => {
  it("keeps only the most recent N", () => {
    const many = Array.from({ length: 5 }, (_, i) => job(String(i), i));
    const out = capJobs(many, 3);
    expect(out.map((j) => j.id)).toEqual(["4", "3", "2"]);
  });
});
