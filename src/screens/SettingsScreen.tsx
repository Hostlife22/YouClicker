import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import type { GlossaryEntry } from "@shared/types";
import { useApp } from "../store";
import { AppFrame } from "../components/AppFrame";
import { api } from "../api";

export function SettingsScreen() {
  const { t } = useTranslation();
  const setScreen = useApp((s) => s.setScreen);
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const authed = useApp((s) => s.authed);
  const setAuth = useApp((s) => s.setAuth);

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [glossary, setGlossary] = useState<GlossaryEntry[]>([]);
  const [glossarySaved, setGlossarySaved] = useState(false);

  useEffect(() => {
    if (settings) {
      setClientId(settings.googleClientId ?? "");
      setClientSecret(settings.googleClientSecret ?? "");
      setGlossary(settings.glossary);
    }
  }, [settings]);

  async function save() {
    const updated = await api().settings.update({
      googleClientId: clientId.trim() || null,
      googleClientSecret: clientSecret.trim() || null,
    });
    setSettings(updated);
    setScreen("login");
  }

  function updateRow(i: number, field: keyof GlossaryEntry, value: string) {
    setGlossary((rows) =>
      rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)),
    );
    setGlossarySaved(false);
  }

  function addRow() {
    setGlossary((rows) => [...rows, { term: "", translation: "" }]);
    setGlossarySaved(false);
  }

  function removeRow(i: number) {
    setGlossary((rows) => rows.filter((_, idx) => idx !== i));
    setGlossarySaved(false);
  }

  async function saveGlossary() {
    // Drop blank rows before persisting.
    const cleaned = glossary.filter((g) => g.term.trim());
    const updated = await api().settings.update({ glossary: cleaned });
    setSettings(updated);
    setGlossary(updated.glossary);
    setGlossarySaved(true);
  }

  async function signOut() {
    await api().accounts.removeAll();
    setAuth(false, null);
  }

  return (
    <AppFrame>
      <div className="h-full overflow-auto p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold">{t("settings.title")}</h1>
          <button onClick={() => setScreen("welcome")} className="outlined-btn">
            {t("app.back")}
          </button>
        </div>

        <section className="mb-6">
          <h2 className="font-medium mb-2">{t("settings.googleOAuth")}</h2>
          <p className="text-xs text-[#a0a0a0] mb-3">
            <a
              className="underline cursor-pointer"
              onClick={() =>
                api().system.openExternal(
                  "https://console.cloud.google.com/apis/credentials",
                )
              }
            >
              {t("settings.howToGetThem")}
            </a>
          </p>
          <label className="block text-sm mb-1">{t("settings.clientId")}</label>
          <input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="123456-abc.apps.googleusercontent.com"
            className="w-full mb-3 px-3 py-2 rounded-md bg-[#1f1f1f] border border-[#3a3a3a] text-sm"
          />
          <label className="block text-sm mb-1">{t("settings.clientSecret")}</label>
          <input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder="GOCSPX-..."
            className="w-full mb-4 px-3 py-2 rounded-md bg-[#1f1f1f] border border-[#3a3a3a] text-sm"
          />
          <button onClick={save} className="outlined-btn">
            {t("settings.save")}
          </button>
        </section>

        <section className="mb-6">
          <h2 className="font-medium mb-1">{t("settings.glossary")}</h2>
          <p className="text-xs text-[#a0a0a0] mb-3">{t("settings.glossaryHint")}</p>
          <div className="space-y-2 mb-3">
            {glossary.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={row.term}
                  onChange={(e) => updateRow(i, "term", e.target.value)}
                  placeholder={t("settings.glossaryTerm")}
                  className="flex-1 px-3 py-2 rounded-md bg-[#1f1f1f] border border-[#3a3a3a] text-sm"
                />
                <input
                  value={row.translation}
                  onChange={(e) => updateRow(i, "translation", e.target.value)}
                  placeholder={t("settings.glossaryTranslation")}
                  className="flex-1 px-3 py-2 rounded-md bg-[#1f1f1f] border border-[#3a3a3a] text-sm"
                />
                <button
                  onClick={() => removeRow(i)}
                  aria-label={t("channels.remove")}
                  className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
                  style={{ background: "#e9e9e9", color: "#1a1a1a" }}
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={addRow} className="outlined-btn text-sm">
              {t("settings.glossaryAdd")}
            </button>
            <button onClick={saveGlossary} className="outlined-btn text-sm">
              {t("settings.glossarySave")}
            </button>
            {glossarySaved && (
              <span className="text-sm text-green-400">{t("settings.glossarySaved")}</span>
            )}
          </div>
        </section>

        {authed && (
          <section>
            <button onClick={signOut} className="outlined-btn danger">
              {t("settings.signOut")}
            </button>
          </section>
        )}
      </div>
    </AppFrame>
  );
}
