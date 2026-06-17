import { useTranslation } from "react-i18next";
import { useApp } from "../store";
import { AppFrame } from "../components/AppFrame";
import { UI_LANGUAGES } from "@shared/languages";
import { api } from "../api";

export function WelcomeScreen() {
  const { t, i18n } = useTranslation();
  const setScreen = useApp((s) => s.setScreen);
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);

  async function pickLanguage(code: "en" | "de" | "fr" | "uk" | "ru") {
    await i18n.changeLanguage(code);
    const updated = await api().settings.update({ uiLanguage: code });
    setSettings(updated);
  }

  async function next() {
    const status = await api().auth.status();
    if (status.authenticated) {
      setScreen("channels");
    } else {
      setScreen("login");
    }
  }

  const current = settings?.uiLanguage ?? "ru";

  return (
    <AppFrame>
      <div className="h-full flex flex-col items-center justify-between p-10">
        <div className="flex-1 flex flex-col items-center justify-center gap-8 w-full">
          <h1 className="text-3xl font-semibold text-center">{t("welcome.title")}</h1>
          <div className="text-5xl">▶️</div>
          <h2 className="text-xl text-center">{t("welcome.selectLanguage")}</h2>
          <div className="flex gap-8 mt-4">
            {UI_LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => pickLanguage(l.code)}
                className={`flex flex-col items-center gap-2 px-3 py-2 rounded-lg transition ${
                  current === l.code ? "bg-[#2a2a2a]" : "hover:bg-[#2a2a2a]"
                }`}
              >
                <span className="text-4xl">{l.flag}</span>
                <span className="text-sm">{l.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end w-full">
          <button onClick={next} className="outlined-btn">
            {t("welcome.continue")}
          </button>
        </div>
      </div>
    </AppFrame>
  );
}
