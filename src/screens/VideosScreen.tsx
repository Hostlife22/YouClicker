import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import type { Video } from "@shared/types";
import { useApp } from "../store";
import { AppFrame } from "../components/AppFrame";
import { Avatar } from "../components/Avatar";
import { errorText } from "../lib/errorText";
import { api } from "../api";

export function VideosScreen() {
  const { t } = useTranslation();
  const channelId = useApp((s) => s.selectedChannelId);
  const accountId = useApp((s) => s.selectedAccountId);
  const channels = useApp((s) => s.channels);
  const setScreen = useApp((s) => s.setScreen);
  const selectVideo = useApp((s) => s.selectVideo);
  const email = useApp((s) => s.email);
  const cached = useApp((s) => (channelId ? s.videosByChannel[channelId] : undefined));
  const setChannelVideos = useApp((s) => s.setChannelVideos);
  const channel = channels.find((c) => c.id === channelId);

  const videos = cached?.videos ?? [];
  const pageToken = cached?.pageToken ?? null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only hit the API when this channel isn't already in the store cache.
  // Returning from a video detail screen reuses the cached list instantly.
  useEffect(() => {
    if (channelId && !cached) void load(null, false);
  }, [channelId]);

  async function load(token: string | null, force: boolean) {
    if (!channelId || !accountId || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api().youtube.videos(
        accountId,
        channelId,
        token,
        channel?.uploadsPlaylistId ?? null,
        force,
      );
      const prev = token ? videos : [];
      setChannelVideos(channelId, {
        videos: [...prev, ...res.videos],
        pageToken: res.nextPageToken,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function openVideo(v: Video) {
    selectVideo(v);
    setScreen("video");
  }

  return (
    <AppFrame
      topRight={<div className="truncate max-w-[260px]">{email ?? ""}</div>}
    >
      <div className="h-full flex p-6 gap-6">
        <div className="w-64 flex flex-col items-center">
          <button
            onClick={() => setScreen("channels")}
            aria-label={t("app.back")}
            className="self-start w-9 h-9 rounded-lg mb-4"
            style={{ background: "#1f1f1f", border: "1px solid #e63946", color: "#e63946" }}
          >
            ◀
          </button>
          {channel && (
            <>
              <div className="mb-3">
                <Avatar src={channel.thumbnailUrl} alt={channel.title} size={128} />
              </div>
              <div className="font-semibold mb-2 text-center">{channel.title}</div>
              <div className="text-sm text-[#a0a0a0] space-y-1">
                <div>📹 {channel.videoCount}</div>
                <div>👁 {channel.viewCount}</div>
                <div>👥 {channel.subscriberCount}</div>
              </div>
            </>
          )}
        </div>
        <div
          className="flex-1 rounded-xl p-4 flex flex-col"
          style={{ background: "#1f1f1f", border: "1px solid #3a3a3a" }}
        >
          {error && (
            <div className="text-sm text-[#e63946] mb-3 px-2">
              {errorText(t, error)}
            </div>
          )}
          <div className="flex-1 overflow-auto space-y-3">
            {videos.length === 0 && !loading && !error && (
              <div className="text-sm text-[#a0a0a0] text-center mt-12">
                {t("videos.empty")}
              </div>
            )}
            {videos.map((v) => (
              <button
                key={v.id}
                onClick={() => openVideo(v)}
                className="w-full flex items-start gap-3 p-2 rounded-lg hover:bg-[#2a2a2a] text-left"
                style={{ background: "#181818" }}
              >
                <Avatar src={v.thumbnailUrl} alt={v.title} size={64} rounded={false} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[#a0a0a0] mb-1">
                    {t("videos.published")}: {new Date(v.publishedAt).toLocaleString()}
                  </div>
                  <div className="text-sm font-medium line-clamp-2">{v.title}</div>
                  <div className="text-xs text-[#a0a0a0] mt-1">
                    » {Object.keys(v.localizations).length}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-[#a0a0a0]">
              {loading ? t("videos.loading") : `${videos.length}`}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => load(null, true)}
                disabled={loading}
                className="outlined-btn text-sm"
              >
                {t("videos.refresh")}
              </button>
              <button
                onClick={() => load(pageToken, false)}
                disabled={!pageToken || loading}
                className="outlined-btn text-sm"
              >
                {t("videos.loadMore")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppFrame>
  );
}
