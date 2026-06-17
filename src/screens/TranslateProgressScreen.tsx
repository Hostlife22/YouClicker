import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { useApp } from "../store";
import { AppFrame } from "../components/AppFrame";
import { findLanguage } from "@shared/languages";
import { errorText } from "../lib/errorText";
import { api } from "../api";

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function TranslateProgressScreen() {
  const { t } = useTranslation();
  const progress = useApp((s) => s.progress);
  const updateProgress = useApp((s) => s.updateProgress);
  const setScreen = useApp((s) => s.setScreen);
  const video = useApp((s) => s.selectedVideo);
  const selectedLanguages = useApp((s) => s.selectedLanguages);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const unsubscribe = api().translate.onProgress((e) => {
      if (e.status === "language_done") {
        updateProgress(e.done, e.currentLanguage ?? null);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (progress.status !== "running") return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [progress.status]);

  const elapsedMs =
    progress.startedAt && (progress.finishedAt ?? now) - progress.startedAt;
  const percent =
    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  const stepLabel =
    progress.step === "title_description"
      ? t("progress.translateTitleDesc")
      : t("progress.translateSubs");

  return (
    <AppFrame>
      <div className="h-full flex flex-col items-center justify-center p-8 gap-6">
        <h1 className="text-2xl font-semibold">{t("progress.title")}</h1>
        <div className="w-full max-w-2xl grid grid-cols-2 gap-8">
          <Step n={1} label={t("progress.selectVideo")} active>
            {video && (
              <div className="bg-[#181818] p-2 rounded-md text-xs">
                <div className="text-[#a0a0a0]">
                  {new Date(video.publishedAt).toLocaleString()}
                </div>
                <div className="line-clamp-2">{video.title}</div>
              </div>
            )}
          </Step>
          <Step n={2} label={t("progress.selectLanguages")} active>
            <div className="text-xs text-[#a0a0a0]">
              {selectedLanguages.length} languages
            </div>
          </Step>
          <Step n={3} label={stepLabel} active={progress.status !== "idle"}>
            <div className="text-xs text-[#a0a0a0]">
              {progress.done} / {progress.total} ({percent}%)
            </div>
            {progress.currentLanguage && (
              <div className="text-xs">
                {t("progress.current", {
                  lang:
                    findLanguage(progress.currentLanguage)?.name ??
                    progress.currentLanguage,
                })}
              </div>
            )}
          </Step>
          <Step n={4} label={t("progress.elapsed")} active={progress.status !== "idle"}>
            <div className="text-3xl font-mono">
              {formatElapsed(elapsedMs || 0)}
            </div>
            {progress.status === "completed" && (
              <div className="text-sm text-green-400 mt-1">
                {t("progress.successTitle")}
              </div>
            )}
            {progress.status === "failed" && progress.error && (
              <div className="text-sm text-[#e63946] mt-1">
                {errorText(t, progress.error)}
              </div>
            )}
          </Step>
        </div>
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => setScreen("video")}
            className="outlined-btn"
            disabled={progress.status === "running"}
          >
            {t("app.back")}
          </button>
          <button
            onClick={() => setScreen("channels")}
            className="outlined-btn"
            disabled={progress.status === "running"}
          >
            {t("app.start")}
          </button>
        </div>
      </div>
    </AppFrame>
  );
}

function Step({
  n,
  label,
  active,
  children,
}: {
  n: number;
  label: string;
  active: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`p-4 rounded-xl ${active ? "border-[#e63946]" : "border-[#3a3a3a]"}`}
      style={{ background: "#1f1f1f", border: "1px solid" }}
    >
      <div className="text-sm text-[#e63946] mb-1">
        {n}. {label}
      </div>
      <div>{children}</div>
    </div>
  );
}
