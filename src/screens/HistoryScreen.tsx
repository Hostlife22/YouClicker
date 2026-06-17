import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import type { TranslationJob } from "@shared/types";
import { useApp } from "../store";
import { AppFrame } from "../components/AppFrame";
import { useDialog } from "../lib/dialog";
import { errorText } from "../lib/errorText";
import { api } from "../api";

const STATUS_COLOR: Record<TranslationJob["status"], string> = {
  running: "#a0a0a0",
  completed: "#4ade80",
  failed: "#e63946",
};

export function HistoryScreen() {
  const { t } = useTranslation();
  const setScreen = useApp((s) => s.setScreen);
  const confirmDialog = useDialog((s) => s.confirm);
  const [jobs, setJobs] = useState<TranslationJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setJobs(await api().jobs.list());
      setLoading(false);
    })();
  }, []);

  async function clearAll() {
    const ok = await confirmDialog({
      title: t("history.clear"),
      message: t("history.confirmClear"),
    });
    if (!ok) return;
    await api().jobs.clear();
    setJobs([]);
  }

  function stepLabel(step: TranslationJob["step"]): string {
    return step === "title_description"
      ? t("progress.translateTitleDesc")
      : t("progress.translateSubs");
  }

  return (
    <AppFrame>
      <div className="h-full flex flex-col p-6">
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setScreen("channels")}
            aria-label={t("app.back")}
            className="w-9 h-9 rounded-lg"
            style={{ background: "#1f1f1f", border: "1px solid #e63946", color: "#e63946" }}
          >
            ◀
          </button>
          <h1 className="text-xl font-semibold">{t("history.title")}</h1>
          <button
            onClick={clearAll}
            disabled={jobs.length === 0}
            className="outlined-btn text-sm ml-auto"
          >
            {t("history.clear")}
          </button>
        </div>

        <div
          className="flex-1 rounded-xl p-3 overflow-auto"
          style={{ background: "#1f1f1f", border: "1px solid #3a3a3a" }}
        >
          {loading ? (
            <div className="text-sm text-[#a0a0a0] text-center mt-12">{t("app.loading")}</div>
          ) : jobs.length === 0 ? (
            <div className="text-sm text-[#a0a0a0] text-center mt-12">{t("history.empty")}</div>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="p-3 rounded-lg text-sm"
                  style={{ background: "#181818" }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium truncate">{job.videoTitle}</div>
                    <div
                      className="text-xs shrink-0"
                      style={{ color: STATUS_COLOR[job.status] }}
                    >
                      {t(`history.status.${job.status}`)}
                    </div>
                  </div>
                  <div className="text-xs text-[#a0a0a0] mt-1">
                    {stepLabel(job.step)} · {new Date(job.startedAt).toLocaleString()}
                  </div>
                  <div className="text-xs mt-1 flex gap-3">
                    <span className="text-[#4ade80]">
                      {t("progress.resultUpdated", { count: job.updated.length })}
                    </span>
                    {job.failed.length > 0 && (
                      <span className="text-[#e63946]">
                        {t("progress.resultFailed", { count: job.failed.length })}
                      </span>
                    )}
                    {job.skipped.length > 0 && (
                      <span className="text-[#a0a0a0]">
                        {t("progress.resultSkipped", { count: job.skipped.length })}
                      </span>
                    )}
                  </div>
                  {job.error && (
                    <div className="text-xs text-[#e63946] mt-1">
                      {errorText(t, job.error)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppFrame>
  );
}
