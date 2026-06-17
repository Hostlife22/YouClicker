import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import log from "electron-log/main";
import {
  getSettings,
  updateSettings,
} from "./store";
import {
  listAccounts,
  addAccount,
  removeAccount,
  migrateLegacyAccount,
} from "./oauth";
import {
  listAllChannels,
  listChannelVideos,
  getVideo,
  listCaptions,
} from "./youtube";
import {
  translateTitleDescriptionMulti,
  translateSubtitlesMulti,
} from "./orchestrator";
import { suppressDevToolsNoise } from "./devtools-noise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

suppressDevToolsNoise();

log.initialize();
log.transports.file.level = "info";

let mainWindow: BrowserWindow | null = null;

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    minWidth: 820,
    minHeight: 620,
    backgroundColor: "#1a1a1a",
    title: "YouClicker Personal",
    titleBarStyle: "default",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    await mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

function registerIpc(): void {
  ipcMain.handle("settings:get", () => getSettings());
  ipcMain.handle("settings:update", (_e, patch) => updateSettings(patch));

  ipcMain.handle("auth:status", () => {
    const accounts = listAccounts();
    return {
      authenticated: accounts.length > 0,
      email: accounts[0]?.email ?? null,
    };
  });

  ipcMain.handle("accounts:list", () => listAccounts());
  ipcMain.handle("accounts:add", () => addAccount());
  ipcMain.handle("accounts:remove", async (_e, email: string) => {
    await removeAccount(email);
    return listAccounts();
  });
  ipcMain.handle("accounts:removeAll", async () => {
    for (const { email } of listAccounts()) {
      await removeAccount(email);
    }
  });

  ipcMain.handle("youtube:channels", (_e, force = false) => listAllChannels(force));
  ipcMain.handle(
    "youtube:videos",
    (
      _e,
      account: string,
      channelId: string,
      pageToken: string | null,
      uploadsPlaylistId: string | null,
      force = false,
    ) => listChannelVideos(account, channelId, pageToken, 25, uploadsPlaylistId, force),
  );
  ipcMain.handle("youtube:video", (_e, account: string, videoId: string, force = false) =>
    getVideo(account, videoId, force),
  );
  ipcMain.handle("youtube:captions", (_e, account: string, videoId: string, force = false) =>
    listCaptions(account, videoId, force),
  );

  ipcMain.handle(
    "translate:titleDescription",
    (_e, account: string, jobId: string, videoId: string, languages: string[]) =>
      translateTitleDescriptionMulti(account, jobId, videoId, languages),
  );
  ipcMain.handle(
    "translate:subtitles",
    (_e, account: string, jobId: string, videoId: string, languages: string[]) =>
      translateSubtitlesMulti(account, jobId, videoId, languages),
  );

  ipcMain.handle("system:openExternal", (_e, url: string) => shell.openExternal(url));
}

app.whenReady().then(async () => {
  await migrateLegacyAccount();
  registerIpc();
  await createWindow();
  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

process.on("unhandledRejection", (reason) => {
  log.error("[main] unhandledRejection", reason);
});
