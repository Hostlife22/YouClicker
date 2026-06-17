import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import type { AccountError, Channel } from "@shared/types";
import { useApp } from "../store";
import { AppFrame } from "../components/AppFrame";
import { Avatar } from "../components/Avatar";
import { errorText } from "../lib/errorText";
import { useDialog } from "../lib/dialog";
import { api } from "../api";

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(".0", "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(".0", "") + "k";
  return String(n);
}

export function ChannelsScreen() {
  const { t } = useTranslation();
  const channels = useApp((s) => s.channels);
  const setChannels = useApp((s) => s.setChannels);
  const setAccounts = useApp((s) => s.setAccounts);
  const setAuth = useApp((s) => s.setAuth);
  const setScreen = useApp((s) => s.setScreen);
  const selectChannel = useApp((s) => s.selectChannel);
  const email = useApp((s) => s.email);
  const confirmDialog = useDialog((s) => s.confirm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountErrors, setAccountErrors] = useState<AccountError[]>([]);

  useEffect(() => {
    if (channels.length === 0) void load(false);
  }, []);

  async function refreshAccounts() {
    const accounts = await api().accounts.list();
    setAccounts(accounts);
    setAuth(accounts.length > 0, accounts[0]?.email ?? null);
  }

  async function load(force: boolean) {
    setLoading(true);
    setError(null);
    try {
      const { channels: list, errors } = await api().youtube.channels(force);
      setChannels(list);
      setAccountErrors(errors);
      await refreshAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function addAccount() {
    setError(null);
    setLoading(true);
    try {
      await api().accounts.add();
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function removeChannel(channel: Channel) {
    const ok = await confirmDialog({
      title: t("channels.remove"),
      message: t("channels.confirmRemove", { account: channel.accountId }),
    });
    if (!ok) return;
    setLoading(true);
    setError(null);
    try {
      await api().accounts.remove(channel.accountId);
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function openChannel(channel: Channel) {
    selectChannel(channel.id, channel.accountId);
    setScreen("videos");
  }

  return (
    <AppFrame
      topRight={<div className="truncate max-w-[260px]">{email ?? ""}</div>}
    >
      <div className="h-full flex p-6 gap-6">
        <div
          className="flex-1 rounded-xl p-4 flex flex-col"
          style={{ background: "#1f1f1f", border: "1px solid #3a3a3a" }}
        >
          <h2 className="text-center text-[#e63946] font-semibold mb-4">
            {t("channels.title")}
          </h2>
          {loading && <div className="text-center text-sm text-[#a0a0a0]">{t("app.loading")}</div>}
          {error && (
            <div className="text-sm text-[#e63946] mb-3">{errorText(t, error)}</div>
          )}
          {accountErrors.map((ae) => (
            <div key={ae.email} className="text-xs text-[#e63946] mb-2">
              {ae.email}: {t("errors.ACCOUNT_REAUTH_NEEDED")}
            </div>
          ))}
          <div className="flex-1 overflow-auto space-y-3">
            {channels.length === 0 && !loading && (
              <div className="text-sm text-[#a0a0a0] text-center mt-12">
                {t("channels.empty")}
              </div>
            )}
            {channels.map((c) => (
              <div
                key={c.id}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-[#2a2a2a]"
                style={{ background: "#181818" }}
              >
                <button
                  onClick={() => openChannel(c)}
                  className="flex-1 flex items-center gap-3 text-left min-w-0"
                >
                  <Avatar src={c.thumbnailUrl} alt={c.title} size={48} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{c.title}</div>
                    <div className="text-xs text-[#a0a0a0]">
                      {t("channels.videos")}: {c.videoCount}{"  "}
                      {t("channels.views")}: {formatNumber(c.viewCount)}{"  "}
                      {t("channels.subscribers")}: {formatNumber(c.subscriberCount)}
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => removeChannel(c)}
                  disabled={loading}
                  title={t("channels.remove")}
                  aria-label={t("channels.remove")}
                  className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
                  style={{ background: "#e9e9e9", color: "#1a1a1a" }}
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 text-center text-sm text-[#a0a0a0]">
            {t("channels.addChannel")}
          </div>
          <div className="flex justify-center mt-2">
            <button
              onClick={addAccount}
              disabled={loading}
              title={t("channels.addChannel")}
              aria-label={t("channels.addChannel")}
              className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
              style={{ background: "#1f1f1f", border: "1px solid #3a3a3a" }}
            >
              G
            </button>
          </div>
        </div>
        <div className="w-72 flex flex-col items-center justify-center">
          <div className="text-6xl mb-4">▶️</div>
          <div className="text-xl font-semibold">YouClicker</div>
          <div className="text-xs text-[#a0a0a0] mt-2">
            {t("channels.developedWith")} YouTube
          </div>
        </div>
      </div>
    </AppFrame>
  );
}
