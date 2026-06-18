import { BrowserWindow } from "electron";
import PQueue from "p-queue";
import log from "electron-log/main";
import {
  getVideo,
  updateVideoLocalizations,
  listCaptions,
  downloadCaption,
  insertCaption,
} from "./youtube";
import {
  translateTitleAndDescription,
  translateTitleAndDescriptionBatch,
} from "./translator";
import { translateSRT } from "./subtitles";
import { saveLocalizationsSnapshot, saveSubtitle } from "./translationsExport";
import { recordJobStart, recordJobFinish } from "./jobs";
import type { ProgressEvent } from "../shared/api";
import type {
  Localizations,
  TitleDescriptionResult,
  SubtitlesResult,
} from "../shared/types";

function emit(event: ProgressEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("translation:progress", event);
  }
}

/**
 * Title/description tuning. Translating into 100+ languages is limited mainly by
 * the per-call `claude` CLI spawn, so we translate several languages per call
 * (one spawn each) and run a few such batches concurrently. `BATCH_SIZE` trades
 * fewer spawns for a larger, riskier JSON response; anything a batch drops falls
 * back to a per-language translation.
 */
const TD_BATCH_SIZE = 12;
const TD_CONCURRENCY = 5;

/**
 * How many subtitle languages to translate+upload concurrently. Each language
 * already batches its own cues internally (see subtitles.ts), so this stays
 * modest to avoid spawning too many `claude` processes at once. Subtitle uploads
 * are quota-heavy (~400 units each), but concurrency doesn't change total cost.
 */
const SUB_CONCURRENCY = 3;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/** Case-insensitive membership: does `record` already hold a key for `code`? */
function hasKey(record: Record<string, unknown>, code: string): boolean {
  const lower = code.toLowerCase();
  return Object.keys(record).some((k) => k.toLowerCase() === lower);
}

export async function translateTitleDescriptionMulti(
  account: string,
  jobId: string,
  videoId: string,
  targetLanguages: string[],
  sourceLanguageOverride: string | null = null,
  onlyUntranslated = false,
): Promise<TitleDescriptionResult> {
  const startedAt = Date.now();
  const video = await getVideo(account, videoId);
  if (!video) throw new Error(`Video ${videoId} not found`);
  const sourceLang =
    sourceLanguageOverride ?? video.defaultLanguage ?? video.defaultAudioLanguage ?? null;

  // When requested, skip languages that already have a localization on the video.
  const langs = onlyUntranslated
    ? targetLanguages.filter((l) => !hasKey(video.localizations, l))
    : targetLanguages;

  recordJobStart({
    id: jobId,
    videoId,
    videoTitle: video.title,
    step: "title_description",
    targetLanguages: langs,
    startedAt,
  });

  const updated: string[] = [];
  const failed: string[] = [];
  const total = langs.length;
  let done = 0;

  emit({
    jobId,
    videoId,
    step: "title_description",
    status: "running",
    done,
    total,
  });

  const queue = new PQueue({ concurrency: TD_CONCURRENCY });
  const newLocalizations: Localizations = {};

  // Translate languages in batches (one CLI spawn per batch); per language,
  // fall back to a single-language call when the batch didn't produce it.
  const finishLanguage = (lang: string, ok: boolean): void => {
    if (ok) updated.push(lang);
    else failed.push(lang);
    done += 1;
    emit({
      jobId,
      videoId,
      step: "title_description",
      status: "language_done",
      done,
      total,
      currentLanguage: lang,
    });
  };

  await Promise.all(
    chunk(langs, TD_BATCH_SIZE).map((batch) =>
      queue.add(async () => {
        let batchResult: Record<string, (typeof newLocalizations)[string]> = {};
        try {
          batchResult = await translateTitleAndDescriptionBatch(
            video.title,
            video.description,
            sourceLang,
            batch,
          );
        } catch (err) {
          log.error("[orchestrator] batch title/desc failed, falling back", {
            batch,
            err: String(err),
          });
        }

        for (const lang of batch) {
          const fromBatch = batchResult[lang];
          if (fromBatch) {
            newLocalizations[lang] = fromBatch;
            finishLanguage(lang, true);
            continue;
          }
          try {
            newLocalizations[lang] = await translateTitleAndDescription(
              video.title,
              video.description,
              sourceLang,
              lang,
            );
            finishLanguage(lang, true);
          } catch (err) {
            log.error("[orchestrator] title/desc translate failed", {
              lang,
              err: String(err),
            });
            finishLanguage(lang, false);
          }
        }
      }),
    ),
  );

  if (Object.keys(newLocalizations).length > 0) {
    // Persist a local JSON snapshot first, so the translation work survives even
    // if the YouTube upload below fails (quota, invalidVideoMetadata, etc.).
    try {
      const snapshotPath = await saveLocalizationsSnapshot({
        jobId,
        videoId,
        videoTitle: video.title,
        sourceLang,
        localizations: newLocalizations,
      });
      log.info("[orchestrator] saved local translations snapshot", { snapshotPath });
    } catch (err) {
      log.error("[orchestrator] failed to save translations snapshot", {
        err: String(err),
      });
    }

    try {
      await updateVideoLocalizations(account, videoId, newLocalizations);
    } catch (err) {
      const message = String(err);
      log.error("[orchestrator] failed to upload localizations to YouTube", {
        videoId,
        err: message,
      });
      // The translations were produced and saved locally, but none reached
      // YouTube — report them as failed (not updated) and surface the error.
      recordJobFinish(jobId, {
        status: "failed",
        updated: [],
        failed: updated,
        error: message,
        finishedAt: Date.now(),
      });
      emit({
        jobId,
        videoId,
        step: "title_description",
        status: "failed",
        done,
        total,
        error: message,
      });
      throw err;
    }
  }

  recordJobFinish(jobId, {
    status: "completed",
    updated,
    failed,
    finishedAt: Date.now(),
  });
  emit({
    jobId,
    videoId,
    step: "title_description",
    status: "completed",
    done,
    total,
    durationMs: Date.now() - startedAt,
  });
  return { updated, failed };
}

export async function translateSubtitlesMulti(
  account: string,
  jobId: string,
  videoId: string,
  targetLanguages: string[],
  sourceLanguageOverride: string | null = null,
  onlyUntranslated = false,
): Promise<SubtitlesResult> {
  const startedAt = Date.now();
  const video = await getVideo(account, videoId);
  if (!video) throw new Error(`Video ${videoId} not found`);
  const sourceLang =
    sourceLanguageOverride ?? video.defaultLanguage ?? video.defaultAudioLanguage ?? null;

  const captions = await listCaptions(account, videoId);

  // When requested, skip languages that already have a caption track uploaded.
  const existingTracks = new Set(captions.map((c) => c.language.toLowerCase()));
  const langs = onlyUntranslated
    ? targetLanguages.filter((l) => !existingTracks.has(l.toLowerCase()))
    : targetLanguages;

  recordJobStart({
    id: jobId,
    videoId,
    videoTitle: video.title,
    step: "subtitles",
    targetLanguages: langs,
    startedAt,
  });

  if (langs.length === 0) {
    recordJobFinish(jobId, {
      status: "completed",
      updated: [],
      failed: [],
      skipped: [],
      finishedAt: Date.now(),
    });
    emit({
      jobId,
      videoId,
      step: "subtitles",
      status: "completed",
      done: 0,
      total: 0,
      durationMs: Date.now() - startedAt,
    });
    return { updated: [], failed: [], skipped: [] };
  }

  if (captions.length === 0) {
    recordJobFinish(jobId, {
      status: "failed",
      error: "NO_SOURCE_CAPTIONS",
      finishedAt: Date.now(),
    });
    emit({
      jobId,
      videoId,
      step: "subtitles",
      status: "failed",
      done: 0,
      total: langs.length,
      error: "NO_SOURCE_CAPTIONS",
    });
    throw new Error("NO_SOURCE_CAPTIONS");
  }
  const sourceCaption =
    captions.find((c) => c.language === sourceLang) ??
    captions.find((c) => c.trackKind === "standard") ??
    captions[0]!;

  const sourceSRT = await downloadCaption(account, sourceCaption.id, "srt");
  if (!sourceSRT.trim()) {
    recordJobFinish(jobId, {
      status: "failed",
      error: "EMPTY_SOURCE_CAPTION",
      finishedAt: Date.now(),
    });
    throw new Error("EMPTY_SOURCE_CAPTION");
  }

  const updated: string[] = [];
  const failed: string[] = [];
  const skipped: string[] = [];
  const total = langs.length;
  let done = 0;

  emit({
    jobId,
    videoId,
    step: "subtitles",
    status: "running",
    done,
    total,
  });

  const emitDone = (lang: string): void => {
    done += 1;
    emit({
      jobId,
      videoId,
      step: "subtitles",
      status: "language_done",
      done,
      total,
      currentLanguage: lang,
    });
  };

  const queue = new PQueue({ concurrency: SUB_CONCURRENCY });
  await Promise.all(
    langs.map((lang) =>
      queue.add(async () => {
        if (lang === sourceCaption.language) {
          skipped.push(lang);
          emitDone(lang);
          return;
        }
        try {
          const translatedSRT = await translateSRT(
            sourceSRT,
            sourceCaption.language || sourceLang,
            lang,
          );
          // Save the SRT locally before upload, so the work survives a failed
          // captions.insert (quota, transient errors, etc.).
          try {
            const file = await saveSubtitle({ jobId, videoId, lang, srt: translatedSRT });
            log.info("[orchestrator] saved subtitle snapshot", { file });
          } catch (err) {
            log.error("[orchestrator] failed to save subtitle snapshot", {
              lang,
              err: String(err),
            });
          }
          // Empty track name → the default subtitle track for the language, so
          // YouTube shows it in the language's own row instead of as a separate
          // named "Language - Name" item alongside the title/description.
          await insertCaption(account, videoId, lang, "", translatedSRT);
          updated.push(lang);
        } catch (err) {
          log.error("[orchestrator] subtitle translate failed", {
            lang,
            err: String(err),
          });
          failed.push(lang);
        }
        emitDone(lang);
      }),
    ),
  );

  recordJobFinish(jobId, {
    status: "completed",
    updated,
    failed,
    skipped,
    finishedAt: Date.now(),
  });
  emit({
    jobId,
    videoId,
    step: "subtitles",
    status: "completed",
    done,
    total,
    durationMs: Date.now() - startedAt,
  });
  return { updated, failed, skipped };
}
