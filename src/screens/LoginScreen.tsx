import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useApp } from "../store";
import { AppFrame } from "../components/AppFrame";
import { errorText } from "../lib/errorText";
import { api } from "../api";

export function LoginScreen() {
  const { t } = useTranslation();
  const setScreen = useApp((s) => s.setScreen);
  const setAuth = useApp((s) => s.setAuth);
  const settings = useApp((s) => s.settings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const credsMissing = !settings?.googleClientId || !settings?.googleClientSecret;

  async function signIn() {
    setError(null);
    setBusy(true);
    try {
      const { email } = await api().accounts.add();
      setAuth(true, email);
      setScreen("channels");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppFrame>
      <div className="h-full flex flex-col items-center justify-center p-8">
        <h1 className="text-xl font-semibold mb-8 text-center max-w-xl">
          {t("login.title")}
        </h1>
        <div className="flex items-center justify-center gap-12 w-full">
          <div className="w-32 h-32 rounded-xl flex items-center justify-center text-5xl"
               style={{ background: "#1f1f1f", border: "1px solid #3a3a3a" }}>
            ▶️
          </div>
          <div
            className="rounded-2xl p-8 w-96"
            style={{ background: "#1f1f1f", border: "1px solid #3a3a3a" }}
          >
            {credsMissing ? (
              <>
                <p className="text-sm text-[#a0a0a0] mb-4">
                  {t("login.promptCredentials")}
                </p>
                <button
                  onClick={() => setScreen("settings")}
                  className="outlined-btn w-full"
                >
                  {t("login.openSettings")}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={signIn}
                  disabled={busy}
                  className="outlined-btn w-full mb-3"
                >
                  {busy ? t("app.loading") : t("login.signInGoogle")}
                </button>
                {error && (
                  <div className="text-sm text-[#e63946] mt-2">
                    {errorText(t, error)}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="w-32 h-32 rounded-xl flex items-center justify-center text-5xl"
               style={{ background: "#1f1f1f", border: "1px solid #3a3a3a" }}>
            G
          </div>
        </div>
      </div>
    </AppFrame>
  );
}
