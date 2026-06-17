import type {
  Video,
  Caption,
  Settings,
  Account,
  AllChannels,
} from "./types";

export type ProgressEvent = {
  jobId: string;
  videoId: string;
  step: "title_description" | "subtitles";
  status: "running" | "language_done" | "completed" | "failed";
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
    ) => Promise<{ videos: Video[]; nextPageToken: string | null; totalResults: number }>;
    video: (account: string, videoId: string, force?: boolean) => Promise<Video | null>;
    captions: (account: string, videoId: string, force?: boolean) => Promise<Caption[]>;
  };
  translate: {
    titleDescription: (
      account: string,
      jobId: string,
      videoId: string,
      languages: string[],
    ) => Promise<{ updated: string[]; failed: string[] }>;
    subtitles: (
      account: string,
      jobId: string,
      videoId: string,
      languages: string[],
    ) => Promise<{ updated: string[]; failed: string[]; skipped: string[] }>;
    onProgress: (cb: (e: ProgressEvent) => void) => () => void;
  };
  system: {
    openExternal: (url: string) => Promise<void>;
  };
};
