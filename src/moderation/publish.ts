import fs from "fs/promises";
// Тот же приём, что в боте публикации: собственный undici (fetch/Agent),
// keepAliveTimeout=1 форсит свежее соединение на каждый публикейт — иначе
// простоявшее в пуле соединение может отдать пустое тело («Unexpected end of
// JSON input»). Публикации редкие, лишний handshake несущественен.
import { fetch, Agent, FormData } from "undici";
import type { PendingModeration } from "./pending.js";

export interface PublishResult {
  trackId: string;
  slug: string;
  studioUrl: string;
}

const freshConnectionAgent = new Agent({ keepAliveTimeout: 1, keepAliveMaxTimeout: 1 });

/**
 * Публикация трека тем же способом, что и бот публикации: multipart на
 * /api/bot/upload сайта (auth x-bot-secret). Логика публикации на сайте не
 * дублируется — используется существующий endpoint.
 */
export async function publishTrack(item: PendingModeration): Promise<PublishResult> {
  const apiUrl = process.env.FORZADJ_API_URL;
  const secret = process.env.FORZADJ_BOT_SECRET;
  if (!apiUrl || !secret) {
    throw new Error("Set FORZADJ_API_URL and FORZADJ_BOT_SECRET in env.");
  }

  const fileBuffer = await fs.readFile(item.filePath);
  const fileBlob = new Blob([fileBuffer], { type: item.mimeType });
  const artworkBlob = item.artworkPath
    ? new Blob([await fs.readFile(item.artworkPath)], { type: "image/png" })
    : null;

  const metadata = {
    title: item.title,
    artist: item.artist,
    genre: item.genre || undefined,
    version: item.version || undefined,
    bpm: item.bpm,
    fileName: item.fileName,
    mimeType: item.mimeType,
  };

  // Content-Disposition filename должен быть ASCII (RFC 7578); оригинал — в metadata.fileName.
  const ext = (item.fileName.match(/\.([a-z0-9]+)$/i)?.[1] ?? "mp3").toLowerCase();

  const form = new FormData();
  form.append("file", fileBlob, `track.${ext}`);
  form.append("metadata", JSON.stringify(metadata));
  if (artworkBlob) form.append("artwork", artworkBlob, "artwork.png");

  const res = await fetch(`${apiUrl.replace(/\/$/, "")}/api/bot/upload`, {
    method: "POST",
    headers: { "x-bot-secret": secret },
    body: form,
    dispatcher: freshConnectionAgent,
  });

  const body = (await res.json()) as
    | { success: true; trackId: string; slug: string; studioUrl: string }
    | { error: string };

  if (!res.ok || !("success" in body)) {
    throw new Error("error" in body ? body.error : `HTTP ${res.status}`);
  }
  return { trackId: body.trackId, slug: body.slug, studioUrl: body.studioUrl };
}
