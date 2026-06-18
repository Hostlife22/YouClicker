import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Localizations } from "../shared/types";

/**
 * Directory holding per-job translation snapshots (JSON), inside the project
 * folder (`<cwd>/translations`) so the files sit next to the code rather than in
 * the OS app-data directory.
 */
export function translationsDir(): string {
  return path.join(process.cwd(), "translations");
}

/** Keep a filename segment to characters that are safe across filesystems. */
function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "") || "untitled";
}

/**
 * Persist the translated localizations to a local JSON file so the work is
 * never lost — even when the subsequent YouTube upload fails (e.g. quota or
 * `invalidVideoMetadata`). The file can be re-applied or inspected later.
 * Returns the absolute path written.
 */
export async function saveLocalizationsSnapshot(input: {
  jobId: string;
  videoId: string;
  videoTitle: string;
  sourceLang: string | null;
  localizations: Localizations;
}): Promise<string> {
  const dir = translationsDir();
  await mkdir(dir, { recursive: true });
  const file = path.join(
    dir,
    `${safeSegment(input.videoId)}-${safeSegment(input.jobId)}.json`,
  );
  const snapshot = {
    jobId: input.jobId,
    videoId: input.videoId,
    videoTitle: input.videoTitle,
    sourceLang: input.sourceLang,
    savedAt: new Date().toISOString(),
    localizations: input.localizations,
  };
  await writeFile(file, JSON.stringify(snapshot, null, 2), "utf8");
  return file;
}

/**
 * Persist one translated subtitle track (SRT) to a per-job folder
 * (`translations/<videoId>-<jobId>/<lang>.srt`) before it is uploaded, so the
 * work survives an upload failure and the files are directly re-usable.
 * Returns the absolute path written.
 */
export async function saveSubtitle(input: {
  jobId: string;
  videoId: string;
  lang: string;
  srt: string;
}): Promise<string> {
  const dir = path.join(
    translationsDir(),
    `${safeSegment(input.videoId)}-${safeSegment(input.jobId)}`,
  );
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${safeSegment(input.lang)}.srt`);
  await writeFile(file, input.srt, "utf8");
  return file;
}

/**
 * Dump the live list of localization languages YouTube supports
 * (`i18nLanguages.list`) to a JSON file, so the static picker list in
 * shared/languages.ts can be reconciled against the source of truth.
 */
export async function saveSupportedLanguages(
  languages: { code: string; name: string }[],
): Promise<string> {
  const dir = translationsDir();
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, "youtube-languages.json");
  const sorted = [...languages].sort((a, b) => a.code.localeCompare(b.code));
  await writeFile(
    file,
    JSON.stringify({ savedAt: new Date().toISOString(), languages: sorted }, null, 2),
    "utf8",
  );
  return file;
}
