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

export type Video = {
  id: string;
  channelId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  publishedAt: string;
  defaultLanguage: string | null;
  defaultAudioLanguage: string | null;
  localizations: Record<string, { title: string; description: string }>;
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
