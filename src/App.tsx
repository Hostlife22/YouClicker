import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useApp } from "./store";
import { api } from "./api";
import { WelcomeScreen } from "./screens/WelcomeScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { ChannelsScreen } from "./screens/ChannelsScreen";
import { VideosScreen } from "./screens/VideosScreen";
import { VideoDetailScreen } from "./screens/VideoDetailScreen";
import { LanguagesScreen } from "./screens/LanguagesScreen";
import { TranslateProgressScreen } from "./screens/TranslateProgressScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { LocalizationsScreen } from "./screens/LocalizationsScreen";
import { DialogHost } from "./components/DialogHost";
import type { Screen } from "./store";

function renderScreen(screen: Screen) {
  switch (screen) {
    case "welcome":
      return <WelcomeScreen />;
    case "login":
      return <LoginScreen />;
    case "settings":
      return <SettingsScreen />;
    case "channels":
      return <ChannelsScreen />;
    case "videos":
      return <VideosScreen />;
    case "video":
      return <VideoDetailScreen />;
    case "languages":
      return <LanguagesScreen />;
    case "progress":
      return <TranslateProgressScreen />;
    case "history":
      return <HistoryScreen />;
    case "localizations":
      return <LocalizationsScreen />;
    default:
      return <WelcomeScreen />;
  }
}

export default function App() {
  const screen = useApp((s) => s.screen);
  const setSettings = useApp((s) => s.setSettings);
  const setAuth = useApp((s) => s.setAuth);
  const { i18n } = useTranslation();

  useEffect(() => {
    void (async () => {
      const settings = await api().settings.get();
      setSettings(settings);
      if (settings.uiLanguage !== i18n.language) {
        await i18n.changeLanguage(settings.uiLanguage);
      }
      const auth = await api().auth.status();
      setAuth(auth.authenticated, auth.email);
    })();
  }, []);

  return (
    <>
      {renderScreen(screen)}
      <DialogHost />
    </>
  );
}
