export type Account = {
  email: string;
};

/** A connected account that could not be listed (e.g. expired refresh token). */
export type AccountError = { email: string; code: string };

/** Result of aggregating channels across all connected accounts. */
export type AllChannels = { channels: Channel[]; errors: AccountError[] };

export type Channel = {
  id: string;
  accountId: string;
  title: string;
  thumbnailUrl: string;
  uploadsPlaylistId: string | null;
  videoCount: number;
  viewCount: number;
  subscriberCount: number;
};

/** A single localized title/description pair, keyed elsewhere by language code. */
export type Localization = { title: string; description: string };

/** Map of language code → localized title/description. */
export type Localizations = Record<string, Localization>;

export type Video = {
  id: string;
  channelId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  publishedAt: string;
  defaultLanguage: string | null;
  defaultAudioLanguage: string | null;
  localizations: Localizations;
};

/** One page of a channel's videos, as returned by `youtube:videos`. */
export type VideoPage = {
  videos: Video[];
  nextPageToken: string | null;
  totalResults: number;
};

export type Caption = {
  id: string;
  language: string;
  name: string;
  trackKind: string;
};

export type Language = {
  code: string;
  name: string;
  nativeName: string;
};

export type TranslationStep = "title_description" | "subtitles";

/** What the user is doing on the languages screen: translate, or just pick. */
export type TranslationMode = TranslationStep | "select";

/** Lifecycle status of a single `ProgressEvent` emitted by the orchestrator. */
export type ProgressStatus = "running" | "language_done" | "completed" | "failed";

/** Result of a multi-language title/description translation run. */
export type TitleDescriptionResult = { updated: string[]; failed: string[] };

/** Result of a multi-language subtitle translation run. */
export type SubtitlesResult = { updated: string[]; failed: string[]; skipped: string[] };

export type TranslationJob = {
  id: string;
  videoId: string;
  step: TranslationStep;
  targetLanguages: string[];
  status: "queued" | "running" | "completed" | "failed";
  progress: { done: number; total: number };
  startedAt: number | null;
  finishedAt: number | null;
  error: string | null;
};

export type Settings = {
  uiLanguage: "en" | "de" | "fr" | "uk" | "ru";
  defaultLanguages: string[];
  googleClientId: string | null;
  googleClientSecret: string | null;
  /** Connected Google accounts (non-secret). Refresh tokens live in keytar. */
  accounts: Account[];
};

export type SubtitleCue = {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
};
