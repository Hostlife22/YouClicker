import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { useApp } from "../store";
import { AppFrame } from "../components/AppFrame";
import { Avatar } from "../components/Avatar";
import { api } from "../api";
import type { TranslationMode } from "@shared/types";

export function VideoDetailScreen() {
  const { t } = useTranslation();
  const video = useApp((s) => s.selectedVideo);
  const accountId = useApp((s) => s.selectedAccountId);
  const setScreen = useApp((s) => s.setScreen);
  const selectedLanguages = useApp((s) => s.selectedLanguages);
  const setSelectedLanguages = useApp((s) => s.setSelectedLanguages);
  const setTranslationMode = useApp((s) => s.setTranslationMode);
  const settings = useApp((s) => s.settings);
  const email = useApp((s) => s.email);

  const [hasCaptions, setHasCaptions] = useState<boolean | null>(null);

  useEffect(() => {
    if (selectedLanguages.length === 0 && settings) {
      setSelectedLanguages(settings.defaultLanguages);
    }
  }, [settings]);

  useEffect(() => {
    if (!video || !accountId) return;
    void api()
      .youtube.captions(accountId, video.id)
      .then((cs) => setHasCaptions(cs.length > 0));
  }, [video?.id, accountId]);

  if (!video) return null;

  function startMode(mode: TranslationMode) {
    setTranslationMode(mode);
    setScreen("languages");
  }

  return (
    <AppFrame
      topRight={<div className="truncate max-w-[260px]">{email ?? ""}</div>}
    >
      <div className="h-full flex p-6 gap-6">
        <div className="w-72 flex flex-col items-center">
          <button
            onClick={() => setScreen("videos")}
            aria-label={t("app.back")}
            className="self-start w-9 h-9 rounded-lg mb-4"
            style={{ background: "#1f1f1f", border: "1px solid #e63946", color: "#e63946" }}
          >
            ◀
          </button>
          <div className="mb-3">
            <Avatar src={video.thumbnailUrl} alt={video.title} size={192} />
          </div>
          <button
            onClick={() => setScreen("localizations")}
            className="text-sm text-[#a0a0a0] mb-4 hover:text-[#e63946]"
            title={t("video.viewLocalizations")}
          >
            » {Object.keys(video.localizations).length}
          </button>
          <div className="text-xs text-[#a0a0a0] mb-2">
            {t("video.selectedLangs", { count: selectedLanguages.length })}
          </div>
          <button
            onClick={() => setScreen("localizations")}
            className="outlined-btn w-full mb-3 text-sm"
          >
            {t("video.viewLocalizations")}
          </button>
          <button
            onClick={() => startMode("select")}
            className="outlined-btn w-full mb-3 text-sm"
          >
            {t("video.pickLanguages")}
          </button>
          <button
            onClick={() => startMode("title_description")}
            className="outlined-btn w-full mb-2"
          >
            {t("video.translateTitleDescription")}
          </button>
          <button
            onClick={() => startMode("subtitles")}
            disabled={hasCaptions === false}
            className="outlined-btn w-full"
            title={hasCaptions === false ? t("video.noSourceCaptions") : ""}
          >
            {t("video.translateSubtitles")}
          </button>
          {hasCaptions === false && (
            <div className="text-xs text-[#e63946] mt-2 text-center">
              {t("video.noSourceCaptions")}
            </div>
          )}
        </div>
        <div
          className="flex-1 rounded-xl p-5 overflow-auto"
          style={{ background: "#1f1f1f", border: "1px solid #3a3a3a" }}
        >
          <div className="mb-4">
            <div className="text-xs text-[#e63946] mb-1">{t("video.title")}</div>
            <div className="text-sm bg-[#181818] p-3 rounded-md">{video.title}</div>
          </div>
          <div>
            <div className="text-xs text-[#e63946] mb-1">{t("video.description")}</div>
            <div className="text-sm bg-[#181818] p-3 rounded-md whitespace-pre-wrap">
              {video.description}
            </div>
          </div>
        </div>
      </div>
    </AppFrame>
  );
}
