import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { useApp } from "../store";
import { AppFrame } from "../components/AppFrame";
import { LANGUAGES, findLanguage } from "@shared/languages";
import { errorText } from "../lib/errorText";
import { api } from "../api";

export function LocalizationsScreen() {
  const { t } = useTranslation();
  const video = useApp((s) => s.selectedVideo);
  const accountId = useApp((s) => s.selectedAccountId);
  const setScreen = useApp((s) => s.setScreen);
  const selectVideo = useApp((s) => s.selectVideo);
  const clearChannelVideos = useApp((s) => s.clearChannelVideos);

  const localized = video?.localizations ?? {};
  const localizedCodes = Object.keys(localized);
  const [lang, setLang] = useState(localizedCodes[0] ?? "en");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the chosen language's current localization into the editor whenever
  // the language changes or the video is refreshed after a save.
  useEffect(() => {
    const loc = video?.localizations[lang];
    setTitle(loc?.title ?? "");
    setDescription(loc?.description ?? "");
    setSaved(false);
    setError(null);
  }, [lang, video]);

  if (!video) return null;

  async function save() {
    if (!accountId || !video || !title.trim()) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await api().youtube.updateLocalizations(accountId, video.id, {
        [lang]: { title: title.trim(), description },
      });
      selectVideo(updated);
      clearChannelVideos(video.channelId);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppFrame>
      <div className="h-full flex flex-col p-6">
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setScreen("video")}
            aria-label={t("app.back")}
            className="w-9 h-9 rounded-lg"
            style={{ background: "#1f1f1f", border: "1px solid #e63946", color: "#e63946" }}
          >
            ◀
          </button>
          <h1 className="text-xl font-semibold truncate">{t("localizations.title")}</h1>
          <div className="ml-auto text-xs text-[#a0a0a0]">
            {t("localizations.count", { count: localizedCodes.length })}
          </div>
        </div>

        <div
          className="flex-1 rounded-xl p-5 overflow-auto flex flex-col gap-4"
          style={{ background: "#1f1f1f", border: "1px solid #3a3a3a" }}
        >
          <div>
            <label className="block text-xs text-[#e63946] mb-1">
              {t("localizations.language")}
            </label>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-[#181818] border border-[#3a3a3a] text-sm"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                  {localized[l.code] ? " ✓" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-[#e63946] mb-1">
              {t("video.title")}
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={video.title}
              className="w-full px-3 py-2 rounded-md bg-[#181818] border border-[#3a3a3a] text-sm"
            />
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <label className="block text-xs text-[#e63946] mb-1">
              {t("video.description")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={video.description}
              className="w-full flex-1 min-h-[160px] px-3 py-2 rounded-md bg-[#181818] border border-[#3a3a3a] text-sm resize-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={busy || !title.trim()}
              className="outlined-btn text-sm"
            >
              {busy ? t("app.loading") : t("localizations.save")}
            </button>
            {saved && (
              <span className="text-sm text-green-400">
                {t("localizations.saved", {
                  lang: findLanguage(lang)?.name ?? lang,
                })}
              </span>
            )}
            {error && <span className="text-sm text-[#e63946]">{errorText(t, error)}</span>}
          </div>
        </div>
      </div>
    </AppFrame>
  );
}
