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
import { translateTitleAndDescription } from "./translator";
import { translateSRT } from "./subtitles";
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

export async function translateTitleDescriptionMulti(
  account: string,
  jobId: string,
  videoId: string,
  targetLanguages: string[],
  sourceLanguageOverride: string | null = null,
): Promise<TitleDescriptionResult> {
  const startedAt = Date.now();
  const video = await getVideo(account, videoId);
  if (!video) throw new Error(`Video ${videoId} not found`);
  const sourceLang =
    sourceLanguageOverride ?? video.defaultLanguage ?? video.defaultAudioLanguage ?? null;

  recordJobStart({
    id: jobId,
    videoId,
    videoTitle: video.title,
    step: "title_description",
    targetLanguages,
    startedAt,
  });

  const updated: string[] = [];
  const failed: string[] = [];
  const total = targetLanguages.length;
  let done = 0;

  emit({
    jobId,
    videoId,
    step: "title_description",
    status: "running",
    done,
    total,
  });

  const queue = new PQueue({ concurrency: 3 });
  const newLocalizations: Localizations = {};

  await Promise.all(
    targetLanguages.map((lang) =>
      queue.add(async () => {
        try {
          const localized = await translateTitleAndDescription(
            video.title,
            video.description,
            sourceLang,
            lang,
          );
          newLocalizations[lang] = localized;
          updated.push(lang);
        } catch (err) {
          log.error("[orchestrator] title/desc translate failed", {
            lang,
            err: String(err),
          });
          failed.push(lang);
        }
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
      }),
    ),
  );

  if (Object.keys(newLocalizations).length > 0) {
    await updateVideoLocalizations(account, videoId, newLocalizations);
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
): Promise<SubtitlesResult> {
  const startedAt = Date.now();
  const video = await getVideo(account, videoId);
  if (!video) throw new Error(`Video ${videoId} not found`);
  const sourceLang =
    sourceLanguageOverride ?? video.defaultLanguage ?? video.defaultAudioLanguage ?? null;

  recordJobStart({
    id: jobId,
    videoId,
    videoTitle: video.title,
    step: "subtitles",
    targetLanguages,
    startedAt,
  });

  const captions = await listCaptions(account, videoId);
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
      total: targetLanguages.length,
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
  const total = targetLanguages.length;
  let done = 0;

  emit({
    jobId,
    videoId,
    step: "subtitles",
    status: "running",
    done,
    total,
  });

  for (const lang of targetLanguages) {
    if (lang === sourceCaption.language) {
      skipped.push(lang);
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
      continue;
    }
    try {
      const translatedSRT = await translateSRT(
        sourceSRT,
        sourceCaption.language || sourceLang,
        lang,
      );
      await insertCaption(account, videoId, lang, `Auto (${lang})`, translatedSRT);
      updated.push(lang);
    } catch (err) {
      log.error("[orchestrator] subtitle translate failed", {
        lang,
        err: String(err),
      });
      failed.push(lang);
    }
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
  }

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
