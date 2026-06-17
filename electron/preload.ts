import { contextBridge, ipcRenderer } from "electron";
import type {
  Video,
  Caption,
  Settings,
  Account,
  AllChannels,
  VideoPage,
  TitleDescriptionResult,
  SubtitlesResult,
  TranslationJob,
  Localizations,
} from "../shared/types";
import type { Api, ProgressEvent } from "../shared/api";

const api: Api = {
  settings: {
    get: (): Promise<Settings> => ipcRenderer.invoke("settings:get"),
    update: (patch: Partial<Settings>): Promise<Settings> =>
      ipcRenderer.invoke("settings:update", patch),
  },
  auth: {
    status: (): Promise<{ authenticated: boolean; email: string | null }> =>
      ipcRenderer.invoke("auth:status"),
  },
  accounts: {
    list: (): Promise<Account[]> => ipcRenderer.invoke("accounts:list"),
    add: (): Promise<Account> => ipcRenderer.invoke("accounts:add"),
    remove: (email: string): Promise<Account[]> =>
      ipcRenderer.invoke("accounts:remove", email),
    removeAll: (): Promise<void> => ipcRenderer.invoke("accounts:removeAll"),
  },
  youtube: {
    channels: (force = false): Promise<AllChannels> =>
      ipcRenderer.invoke("youtube:channels", force),
    videos: (
      account: string,
      channelId: string,
      pageToken: string | null,
      uploadsPlaylistId: string | null = null,
      force = false,
    ): Promise<VideoPage> =>
      ipcRenderer.invoke(
        "youtube:videos",
        account,
        channelId,
        pageToken,
        uploadsPlaylistId,
        force,
      ),
    video: (account: string, videoId: string, force = false): Promise<Video | null> =>
      ipcRenderer.invoke("youtube:video", account, videoId, force),
    captions: (account: string, videoId: string, force = false): Promise<Caption[]> =>
      ipcRenderer.invoke("youtube:captions", account, videoId, force),
    updateLocalizations: (
      account: string,
      videoId: string,
      localizations: Localizations,
    ): Promise<Video> =>
      ipcRenderer.invoke("youtube:updateLocalizations", account, videoId, localizations),
  },
  translate: {
    titleDescription: (
      account: string,
      jobId: string,
      videoId: string,
      languages: string[],
    ): Promise<TitleDescriptionResult> =>
      ipcRenderer.invoke("translate:titleDescription", account, jobId, videoId, languages),
    subtitles: (
      account: string,
      jobId: string,
      videoId: string,
      languages: string[],
    ): Promise<SubtitlesResult> =>
      ipcRenderer.invoke("translate:subtitles", account, jobId, videoId, languages),
    onProgress: (cb: (e: ProgressEvent) => void): (() => void) => {
      const listener = (_: unknown, payload: ProgressEvent) => cb(payload);
      ipcRenderer.on("translation:progress", listener);
      return () => ipcRenderer.removeListener("translation:progress", listener);
    },
  },
  jobs: {
    list: (): Promise<TranslationJob[]> => ipcRenderer.invoke("jobs:list"),
    clear: (): Promise<void> => ipcRenderer.invoke("jobs:clear"),
  },
  system: {
    openExternal: (url: string): Promise<void> =>
      ipcRenderer.invoke("system:openExternal", url),
  },
};

contextBridge.exposeInMainWorld("api", api);
