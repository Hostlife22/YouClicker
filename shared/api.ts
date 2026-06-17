import type {
  Video,
  Caption,
  Settings,
  Account,
  AllChannels,
  VideoPage,
  TranslationStep,
  ProgressStatus,
  TitleDescriptionResult,
  SubtitlesResult,
  TranslationJob,
  Localizations,
} from "./types";

export type ProgressEvent = {
  jobId: string;
  videoId: string;
  step: TranslationStep;
  status: ProgressStatus;
  done: number;
  total: number;
  currentLanguage?: string;
  durationMs?: number;
  error?: string;
};

export type Api = {
  settings: {
    get: () => Promise<Settings>;
    update: (patch: Partial<Settings>) => Promise<Settings>;
  };
  auth: {
    /** authenticated = at least one account connected; email = first account. */
    status: () => Promise<{ authenticated: boolean; email: string | null }>;
  };
  accounts: {
    list: () => Promise<Account[]>;
    /** Run the OAuth flow under a newly chosen Google account. */
    add: () => Promise<Account>;
    remove: (email: string) => Promise<Account[]>;
    removeAll: () => Promise<void>;
  };
  youtube: {
    channels: (force?: boolean) => Promise<AllChannels>;
    videos: (
      account: string,
      channelId: string,
      pageToken: string | null,
      uploadsPlaylistId?: string | null,
      force?: boolean,
    ) => Promise<VideoPage>;
    video: (account: string, videoId: string, force?: boolean) => Promise<Video | null>;
    captions: (account: string, videoId: string, force?: boolean) => Promise<Caption[]>;
    /** Merge the given localizations into the video and return the updated video. */
    updateLocalizations: (
      account: string,
      videoId: string,
      localizations: Localizations,
    ) => Promise<Video>;
  };
  translate: {
    titleDescription: (
      account: string,
      jobId: string,
      videoId: string,
      languages: string[],
    ) => Promise<TitleDescriptionResult>;
    subtitles: (
      account: string,
      jobId: string,
      videoId: string,
      languages: string[],
    ) => Promise<SubtitlesResult>;
    onProgress: (cb: (e: ProgressEvent) => void) => () => void;
  };
  jobs: {
    list: () => Promise<TranslationJob[]>;
    clear: () => Promise<void>;
  };
  system: {
    openExternal: (url: string) => Promise<void>;
  };
};
