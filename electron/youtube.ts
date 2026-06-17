import { google, youtube_v3 } from "googleapis";
import { getAuthClient } from "./oauth";
import { getAccounts } from "./store";
import type {
  Channel,
  Video,
  Caption,
  AccountError,
  AllChannels,
  Localizations,
  VideoPage,
} from "../shared/types";
import { withCache, invalidate, TTL } from "./cache";
import { withRetry } from "./retry";
import log from "electron-log/main";

/**
 * All YouTube calls are made on behalf of a specific connected account,
 * identified by its email. Cache keys are namespaced by account so two
 * accounts never read each other's entries.
 */
async function yt(account: string): Promise<youtube_v3.Youtube> {
  const auth = await getAuthClient(account);
  return google.youtube({ version: "v3", auth });
}

export async function listMyChannels(
  account: string,
  force = false,
): Promise<Channel[]> {
  return withCache(`channels:${account}`, TTL.CHANNELS, force, async () => {
    const client = await yt(account);
    const res = await withRetry(
      () =>
        client.channels.list({
          part: ["snippet", "statistics", "contentDetails"],
          mine: true,
          maxResults: 50,
        }),
      { label: "channels.list" },
    );
    return (res.data.items ?? []).map((c) => ({
      id: c.id ?? "",
      accountId: account,
      title: c.snippet?.title ?? "",
      thumbnailUrl:
        c.snippet?.thumbnails?.high?.url ??
        c.snippet?.thumbnails?.medium?.url ??
        c.snippet?.thumbnails?.default?.url ??
        "",
      uploadsPlaylistId: c.contentDetails?.relatedPlaylists?.uploads ?? null,
      videoCount: Number(c.statistics?.videoCount ?? 0),
      viewCount: Number(c.statistics?.viewCount ?? 0),
      subscriberCount: Number(c.statistics?.subscriberCount ?? 0),
    }));
  });
}

/**
 * Aggregate channels across every connected account. Tolerant of a single
 * account failing (e.g. a refresh token expired in OAuth "Testing" mode after
 * 7 days): that account is reported in `errors` instead of failing the list.
 */
export async function listAllChannels(force = false): Promise<AllChannels> {
  const accounts = getAccounts();
  const channels: Channel[] = [];
  const errors: AccountError[] = [];

  await Promise.all(
    accounts.map(async ({ email }) => {
      try {
        channels.push(...(await listMyChannels(email, force)));
      } catch (err) {
        const code = err instanceof Error ? err.message : String(err);
        log.error("[youtube] channel list failed for account", { email, code });
        errors.push({ email, code });
      }
    }),
  );

  return { channels, errors };
}

export async function listChannelVideos(
  account: string,
  channelId: string,
  pageToken: string | null = null,
  pageSize = 25,
  uploadsPlaylistId: string | null = null,
  force = false,
): Promise<VideoPage> {
  const key = `videos:${account}:${channelId}:${pageToken ?? "first"}:${pageSize}`;
  return withCache(key, TTL.VIDEOS, force, async () => {
    const client = await yt(account);
    let uploadsId = uploadsPlaylistId;
    if (!uploadsId) {
      const chRes = await withRetry(
        () => client.channels.list({ part: ["contentDetails"], id: [channelId] }),
        { label: "channels.list" },
      );
      uploadsId = chRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null;
    }
    if (!uploadsId) {
      return { videos: [], nextPageToken: null, totalResults: 0 };
    }
    const playlistId = uploadsId;
    const plRes = await withRetry(
      () =>
        client.playlistItems.list({
          part: ["contentDetails", "snippet"],
          playlistId,
          maxResults: pageSize,
          pageToken: pageToken ?? undefined,
        }),
      { label: "playlistItems.list" },
    );
    const ids = (plRes.data.items ?? [])
      .map((i) => i.contentDetails?.videoId)
      .filter((id): id is string => Boolean(id));
    if (ids.length === 0) {
      return {
        videos: [],
        nextPageToken: plRes.data.nextPageToken ?? null,
        totalResults: plRes.data.pageInfo?.totalResults ?? 0,
      };
    }
    const vRes = await withRetry(
      () => client.videos.list({ part: ["snippet", "localizations"], id: ids }),
      { label: "videos.list" },
    );
    const videos: Video[] = (vRes.data.items ?? []).map(toVideo);
    return {
      videos,
      nextPageToken: plRes.data.nextPageToken ?? null,
      totalResults: plRes.data.pageInfo?.totalResults ?? videos.length,
    };
  });
}

export async function getVideo(
  account: string,
  videoId: string,
  force = false,
): Promise<Video | null> {
  return withCache(`video:${account}:${videoId}`, TTL.VIDEO, force, async () => {
    const client = await yt(account);
    const res = await withRetry(
      () => client.videos.list({ part: ["snippet", "localizations"], id: [videoId] }),
      { label: "videos.list" },
    );
    const item = res.data.items?.[0];
    return item ? toVideo(item) : null;
  });
}

function toVideo(item: youtube_v3.Schema$Video): Video {
  const locs: Localizations = {};
  const rawLocs = (item.localizations ?? {}) as Record<
    string,
    { title?: string | null; description?: string | null }
  >;
  for (const [lang, value] of Object.entries(rawLocs)) {
    locs[lang] = {
      title: value.title ?? "",
      description: value.description ?? "",
    };
  }
  return {
    id: item.id ?? "",
    channelId: item.snippet?.channelId ?? "",
    title: item.snippet?.title ?? "",
    description: item.snippet?.description ?? "",
    thumbnailUrl:
      item.snippet?.thumbnails?.medium?.url ??
      item.snippet?.thumbnails?.default?.url ??
      "",
    publishedAt: item.snippet?.publishedAt ?? "",
    defaultLanguage: item.snippet?.defaultLanguage ?? null,
    defaultAudioLanguage: item.snippet?.defaultAudioLanguage ?? null,
    localizations: locs,
  };
}

export async function updateVideoLocalizations(
  account: string,
  videoId: string,
  newLocalizations: Localizations,
): Promise<Video> {
  const client = await yt(account);
  const existing = await withRetry(
    () => client.videos.list({ part: ["snippet", "localizations"], id: [videoId] }),
    { label: "videos.list" },
  );
  const item = existing.data.items?.[0];
  if (!item) throw new Error(`Video ${videoId} not found`);

  const existingLocs: Localizations = {};
  const rawLocs = (item.localizations ?? {}) as Record<
    string,
    { title?: string | null; description?: string | null }
  >;
  for (const [lang, value] of Object.entries(rawLocs)) {
    existingLocs[lang] = {
      title: value.title ?? "",
      description: value.description ?? "",
    };
  }
  const mergedLocalizations: Localizations = {
    ...existingLocs,
    ...newLocalizations,
  };

  const res = await withRetry(
    () =>
      client.videos.update({
        part: ["snippet", "localizations"],
        requestBody: {
          id: videoId,
          snippet: {
            title: item.snippet?.title ?? "",
            description: item.snippet?.description ?? "",
            categoryId: item.snippet?.categoryId ?? undefined,
            defaultLanguage: item.snippet?.defaultLanguage ?? undefined,
            tags: item.snippet?.tags ?? undefined,
          },
          localizations: mergedLocalizations,
        },
      }),
    { label: "videos.update" },
  );
  log.info("[youtube] updated localizations", {
    videoId,
    added: Object.keys(newLocalizations),
  });
  const video = toVideo(res.data);
  // Localizations changed → drop the cached video and every cached page of its
  // channel (for this account) so the renderer's "» N localizations" refreshes.
  invalidate(`video:${account}:${videoId}`, `videos:${account}:${video.channelId}`);
  return video;
}

export async function listCaptions(
  account: string,
  videoId: string,
  force = false,
): Promise<Caption[]> {
  return withCache(`captions:${account}:${videoId}`, TTL.CAPTIONS, force, async () => {
    const client = await yt(account);
    const res = await withRetry(
      () => client.captions.list({ part: ["snippet"], videoId }),
      { label: "captions.list" },
    );
    return (res.data.items ?? []).map((c) => ({
      id: c.id ?? "",
      language: c.snippet?.language ?? "",
      name: c.snippet?.name ?? "",
      trackKind: c.snippet?.trackKind ?? "standard",
    }));
  });
}

export async function downloadCaption(
  account: string,
  captionId: string,
  format: "srt" | "vtt" = "srt",
): Promise<string> {
  const client = await yt(account);
  const res = await withRetry(
    () =>
      client.captions.download(
        { id: captionId, tfmt: format },
        { responseType: "text" },
      ),
    { label: "captions.download" },
  );
  return typeof res.data === "string"
    ? res.data
    : String(res.data ?? "");
}

export async function insertCaption(
  account: string,
  videoId: string,
  language: string,
  name: string,
  srtBody: string,
): Promise<string> {
  const client = await yt(account);
  const { Readable } = await import("node:stream");
  const res = await client.captions.insert({
    part: ["snippet"],
    requestBody: {
      snippet: {
        videoId,
        language,
        name,
        isDraft: false,
      },
    },
    media: {
      mimeType: "application/octet-stream",
      body: Readable.from([srtBody]),
    },
  });
  log.info("[youtube] inserted caption", { videoId, language });
  invalidate(`captions:${account}:${videoId}`);
  return res.data.id ?? "";
}
