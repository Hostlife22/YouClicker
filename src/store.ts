import { create } from "zustand";
import type {
  Account,
  Channel,
  Settings,
  Video,
  TranslationStep,
  TranslationMode,
} from "@shared/types";

export type Screen =
  | "welcome"
  | "login"
  | "settings"
  | "channels"
  | "videos"
  | "video"
  | "languages"
  | "progress"
  | "history"
  | "localizations";

type TranslationResult = {
  updated: string[];
  failed: string[];
  skipped?: string[];
};

type ProgressState = {
  jobId: string | null;
  videoId: string | null;
  step: TranslationStep | null;
  status: "idle" | "running" | "completed" | "failed";
  done: number;
  total: number;
  currentLanguage: string | null;
  startedAt: number | null;
  finishedAt: number | null;
  error: string | null;
  result: TranslationResult | null;
};

type VideoCacheEntry = { videos: Video[]; pageToken: string | null };

type AppState = {
  screen: Screen;
  settings: Settings | null;
  authed: boolean;
  email: string | null;
  accounts: Account[];
  channels: Channel[];
  selectedChannelId: string | null;
  selectedAccountId: string | null;
  selectedVideo: Video | null;
  selectedLanguages: string[];
  /** Source-language override for the next job; null = auto-detect. */
  sourceLanguage: string | null;
  translationMode: TranslationMode | null;
  videosByChannel: Record<string, VideoCacheEntry>;
  progress: ProgressState;
  setScreen: (s: Screen) => void;
  setSettings: (s: Settings) => void;
  setAuth: (authed: boolean, email: string | null) => void;
  setAccounts: (a: Account[]) => void;
  setChannels: (c: Channel[]) => void;
  selectChannel: (id: string, accountId: string) => void;
  selectVideo: (v: Video | null) => void;
  setSourceLanguage: (code: string | null) => void;
  setChannelVideos: (channelId: string, entry: VideoCacheEntry) => void;
  clearChannelVideos: (channelId: string) => void;
  setSelectedLanguages: (langs: string[]) => void;
  toggleLanguage: (code: string) => void;
  setTranslationMode: (mode: TranslationMode | null) => void;
  startJob: (jobId: string, videoId: string, step: TranslationStep, total: number) => void;
  updateProgress: (done: number, currentLanguage: string | null) => void;
  finishJob: (
    status: "completed" | "failed",
    opts?: { error?: string; result?: TranslationResult },
  ) => void;
};

const emptyProgress: ProgressState = {
  jobId: null,
  videoId: null,
  step: null,
  status: "idle",
  done: 0,
  total: 0,
  currentLanguage: null,
  startedAt: null,
  finishedAt: null,
  error: null,
  result: null,
};

export const useApp = create<AppState>((set) => ({
  screen: "welcome",
  settings: null,
  authed: false,
  email: null,
  accounts: [],
  channels: [],
  selectedChannelId: null,
  selectedAccountId: null,
  selectedVideo: null,
  selectedLanguages: [],
  sourceLanguage: null,
  translationMode: null,
  videosByChannel: {},
  progress: emptyProgress,
  setScreen: (screen) => set({ screen }),
  setSettings: (settings) => set({ settings }),
  setAuth: (authed, email) => set({ authed, email }),
  setAccounts: (accounts) => set({ accounts }),
  setChannels: (channels) => set({ channels }),
  selectChannel: (id, accountId) =>
    set({ selectedChannelId: id, selectedAccountId: accountId }),
  selectVideo: (v) => set({ selectedVideo: v, sourceLanguage: null }),
  setSourceLanguage: (sourceLanguage) => set({ sourceLanguage }),
  setChannelVideos: (channelId, entry) =>
    set((s) => ({
      videosByChannel: { ...s.videosByChannel, [channelId]: entry },
    })),
  clearChannelVideos: (channelId) =>
    set((s) => {
      const { [channelId]: _, ...rest } = s.videosByChannel;
      return { videosByChannel: rest };
    }),
  setSelectedLanguages: (langs) => set({ selectedLanguages: langs }),
  setTranslationMode: (translationMode) => set({ translationMode }),
  toggleLanguage: (code) =>
    set((s) => ({
      selectedLanguages: s.selectedLanguages.includes(code)
        ? s.selectedLanguages.filter((c) => c !== code)
        : [...s.selectedLanguages, code],
    })),
  startJob: (jobId, videoId, step, total) =>
    set({
      progress: {
        jobId,
        videoId,
        step,
        status: "running",
        done: 0,
        total,
        currentLanguage: null,
        startedAt: Date.now(),
        finishedAt: null,
        error: null,
        result: null,
      },
    }),
  updateProgress: (done, currentLanguage) =>
    set((s) => ({ progress: { ...s.progress, done, currentLanguage } })),
  finishJob: (status, opts) =>
    set((s) => ({
      progress: {
        ...s.progress,
        status,
        finishedAt: Date.now(),
        error: opts?.error ?? null,
        result: opts?.result ?? s.progress.result,
      },
    })),
}));
