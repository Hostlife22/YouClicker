import { useTranslation } from "react-i18next";
import { useApp } from "../store";
import { AppFrame } from "../components/AppFrame";
import { LANGUAGES } from "@shared/languages";
import { estimateQuota, exceedsDailyQuota, DAILY_QUOTA } from "@shared/quota";
import { api } from "../api";
import { useState } from "react";

export function LanguagesScreen() {
  const { t } = useTranslation();
  const selected = useApp((s) => s.selectedLanguages);
  const setSelected = useApp((s) => s.setSelectedLanguages);
  const toggle = useApp((s) => s.toggleLanguage);
  const setScreen = useApp((s) => s.setScreen);
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const startJob = useApp((s) => s.startJob);
  const finishJob = useApp((s) => s.finishJob);
  const video = useApp((s) => s.selectedVideo);
  const accountId = useApp((s) => s.selectedAccountId);
  const selectVideo = useApp((s) => s.selectVideo);
  const clearChannelVideos = useApp((s) => s.clearChannelVideos);
  const mode = useApp((s) => s.translationMode) ?? "title_description";

  const [busy, setBusy] = useState(false);

  function selectAll() {
    setSelected(LANGUAGES.map((l) => l.code));
  }
  function invert() {
    const set = new Set(selected);
    setSelected(LANGUAGES.filter((l) => !set.has(l.code)).map((l) => l.code));
  }
  async function loadDefault() {
    if (settings) setSelected(settings.defaultLanguages);
  }
  async function saveDefault() {
    const updated = await api().settings.update({ defaultLanguages: selected });
    setSettings(updated);
  }

  async function confirm() {
    if (mode === "select") {
      setScreen("video");
      return;
    }
    if (!video || !accountId || selected.length === 0) return;

    // Subtitle uploads are the expensive path (~400 quota units each). Warn
    // before a run that would likely exceed the daily quota.
    if (mode === "subtitles" && exceedsDailyQuota("subtitles", selected.length)) {
      const ok = window.confirm(
        t("languages.quotaWarning", {
          units: estimateQuota("subtitles", selected.length),
          limit: DAILY_QUOTA,
        }),
      );
      if (!ok) return;
    }

    const jobId = `${Date.now()}`;
    startJob(jobId, video.id, mode, selected.length);
    setScreen("progress");
    setBusy(true);
    try {
      const result =
        mode === "title_description"
          ? await api().translate.titleDescription(accountId, jobId, video.id, selected)
          : await api().translate.subtitles(accountId, jobId, video.id, selected);
      finishJob("completed", { result });
      // The job mutated server-side localizations/captions; the main-process
      // cache was already invalidated. Refresh the renderer's copies so the
      // detail screen's localization count and the channel list stay accurate.
      const fresh = await api().youtube.video(accountId, video.id, true);
      if (fresh) selectVideo(fresh);
      clearChannelVideos(video.channelId);
    } catch (err) {
      finishJob("failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppFrame>
      <div className="h-full flex flex-col p-6">
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setScreen("video")}
            className="w-9 h-9 rounded-lg"
            style={{ background: "#1f1f1f", border: "1px solid #e63946", color: "#e63946" }}
          >
            ◀
          </button>
          <button onClick={selectAll} className="outlined-btn text-sm">
            {t("languages.selectAll")}
          </button>
          <button onClick={invert} className="outlined-btn text-sm">
            {t("languages.invert")}
          </button>
          <div className="ml-auto text-xs text-[#a0a0a0]">
            {t("languages.selectedCount", { count: selected.length })}
          </div>
        </div>
        <div
          className="flex-1 rounded-xl p-2 overflow-auto"
          style={{ background: "#1f1f1f", border: "1px solid #3a3a3a" }}
        >
          <div className="grid grid-cols-3 gap-x-2 gap-y-1">
            {LANGUAGES.map((l) => {
              const on = selected.includes(l.code);
              return (
                <label
                  key={l.code}
                  className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-[#252525]"
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(l.code)}
                    className="accent-[#e63946]"
                  />
                  <span className={`text-sm ${on ? "text-[#e63946]" : ""}`}>
                    {l.name}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button onClick={loadDefault} className="outlined-btn text-sm">
            {t("languages.loadDefault")}
          </button>
          <button onClick={saveDefault} className="outlined-btn text-sm">
            {t("languages.saveDefault")}
          </button>
          <div className="ml-auto">
            <button
              onClick={confirm}
              disabled={busy || selected.length === 0 || !video}
              className="outlined-btn"
            >
              {mode === "select" ? t("app.save") : t("progress.completeStep")}
            </button>
          </div>
        </div>
      </div>
    </AppFrame>
  );
}
