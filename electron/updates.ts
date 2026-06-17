import { app } from "electron";
import log from "electron-log/main";
import type { UpdateInfo } from "../shared/types";
import { isNewer } from "./version";

const REPO = "Hostlife22/YouClicker";
const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`;

/**
 * Lightweight update check: ask GitHub for the latest release and compare its
 * tag to the running version. Fails silently (returns null) on any network or
 * parse error — a background check should never surface an error to the user.
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "YouClicker" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { tag_name?: string; html_url?: string };
    const latestVersion = (data.tag_name ?? "").replace(/^v/i, "");
    if (!latestVersion) return null;

    const currentVersion = app.getVersion();
    return {
      currentVersion,
      latestVersion,
      url: data.html_url ?? RELEASES_PAGE,
      updateAvailable: isNewer(latestVersion, currentVersion),
    };
  } catch (err) {
    log.warn("[updates] check failed", { err: String(err) });
    return null;
  }
}
