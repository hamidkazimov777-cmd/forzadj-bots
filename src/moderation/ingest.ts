import http from "http";
import { writeFile, mkdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import type { Bot } from "grammy";
import { pendingStore, type PendingModeration } from "./pending.js";
import { getArtworkPath } from "./artwork.js";
import { buildPreviewText, buildPreviewKeyboard } from "./preview.js";

/**
 * Тело запроса от сайта (submission.actions → localhost). Аудио — base64
 * (сайт и бот на одном VPS, multipart не нужен).
 */
interface IngestBody {
  submissionId: string;
  audioBase64: string;
  fileName: string;
  mimeType: string;
  title: string;
  artist: string;
  version?: string;
  genre?: string;
  bpm?: number;
  key?: string;
  description?: string;
  author?: string;
  contacts?: string;
  socials?: string[];
  submitter: { userId: string; name: string; telegram?: string };
}

const MAX_BODY_BYTES = 200 * 1024 * 1024;

function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/**
 * Запускает локальный HTTP-сервер приёма заявок на модерацию. При получении
 * заявки сохраняет аудио во временный файл, кладёт в очередь и отправляет
 * администратору превью с кнопками Edit/Publish/Reject.
 */
export function startIngestServer(bot: Bot, adminChatId: number): void {
  // Боты живут на Railway: порт назначается через $PORT, слушаем на 0.0.0.0
  // (публичный ingest, куда сайт присылает заявки на модерацию).
  const port = Number(process.env.PORT ?? process.env.MODERATION_INGEST_PORT ?? 8790);
  const host = "0.0.0.0";
  const secret = process.env.MODERATION_INGEST_SECRET;
  if (!secret) {
    console.error("Error: MODERATION_INGEST_SECRET is missing.");
    process.exit(1);
  }

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method !== "POST" || req.url !== "/ingest") {
        res.writeHead(404).end("not found");
        return;
      }
      if (req.headers["x-ingest-secret"] !== secret) {
        res.writeHead(401).end("unauthorized");
        return;
      }

      const raw = await readBody(req);
      const body = JSON.parse(raw.toString("utf8")) as IngestBody;

      const ext = (body.fileName.match(/\.([a-z0-9]+)$/i)?.[1] ?? "mp3").toLowerCase();
      const dir = join(tmpdir(), "forzadj-moderation");
      await mkdir(dir, { recursive: true });
      const filePath = join(dir, `${body.submissionId}.${ext}`);
      await writeFile(filePath, Buffer.from(body.audioBase64, "base64"));

      const item: PendingModeration = {
        submissionId: body.submissionId,
        filePath,
        fileName: body.fileName,
        mimeType: body.mimeType || "audio/mpeg",
        title: body.title,
        artist: body.artist,
        version: body.version ?? "",
        genre: body.genre ?? "",
        bpm: body.bpm,
        key: body.key,
        description: body.description,
        author: body.author,
        contacts: body.contacts,
        socials: body.socials,
        submitter: body.submitter,
        artworkPath: await getArtworkPath(body.genre),
      };

      const size = pendingStore.push(adminChatId, item);
      const pos = size; // новая заявка встаёт в конец
      await bot.api.sendMessage(adminChatId, buildPreviewText(item, pos, size), {
        reply_markup: buildPreviewKeyboard(),
      });

      res.writeHead(200, { "Content-Type": "application/json" }).end(
        JSON.stringify({ ok: true }),
      );
    } catch (err) {
      console.error("[moderation-ingest] error:", err);
      res.writeHead(500, { "Content-Type": "application/json" }).end(
        JSON.stringify({ ok: false, error: String(err) }),
      );
    }
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`[moderation-ingest] listening on 127.0.0.1:${port}`);
  });
}
