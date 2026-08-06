import { Bot, GrammyError } from "grammy";
import { unlink } from "fs/promises";
import { requireEnv } from "../shared/config.js";
import { authMiddleware } from "../shared/auth.js";
import { pendingStore, type PendingModeration } from "./pending.js";
import {
  buildPreviewText,
  buildPreviewKeyboard,
  buildEditKeyboard,
  buildRejectKeyboard,
  REJECT_REASONS,
} from "./preview.js";
import { getArtworkPath } from "./artwork.js";
import { publishTrack } from "./publish.js";
import { reportDecision } from "./site.js";
import { startIngestServer } from "./ingest.js";

/**
 * Бот модерации (@forzadj_creator_bot). Заявки приходят из сайта через
 * HTTP-ingest. Администратор редактирует метаданные (Edit) и публикует (Publish
 * → /api/bot/upload, как бот публикации) или отклоняет (Reject + причина).
 * Решение отправляется на сайт (reportDecision) — там меняется статус и
 * уведомляется пользователь.
 */

const token = requireEnv("MODERATION_BOT_TOKEN");
const adminChatId = Number(
  process.env.MODERATION_ADMIN_CHAT_ID ?? process.env.ALLOWED_TELEGRAM_IDS?.split(",")[0],
);
if (!Number.isInteger(adminChatId) || adminChatId <= 0) {
  console.error("Error: MODERATION_ADMIN_CHAT_ID is missing or invalid.");
  process.exit(1);
}

const bot = new Bot(token);
bot.use(authMiddleware);

bot.command("start", (ctx) =>
  ctx.reply(
    "🛡 Бот модерации ForzaDJ.\n\nЗаявки пользователей приходят сюда автоматически. " +
      "Проверьте, при необходимости отредактируйте метаданные и нажмите Publish " +
      "(трек публикуется в каталог) или Reject (с причиной).",
  ),
);

async function showCurrent(chatId: number): Promise<void> {
  const item = pendingStore.peek(chatId);
  const size = pendingStore.size(chatId);
  if (!item) {
    await bot.api.sendMessage(chatId, "✅ Очередь модерации пуста.");
    return;
  }
  await bot.api.sendMessage(chatId, buildPreviewText(item, 1, size), {
    reply_markup: buildPreviewKeyboard(),
  });
}

async function cleanup(item: PendingModeration): Promise<void> {
  try {
    await unlink(item.filePath);
  } catch {
    /* файл мог быть уже удалён */
  }
}

// ─── Edit ───────────────────────────────────────────────────────────────────
bot.callbackQuery("edit", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply("Что изменить?", { reply_markup: buildEditKeyboard() });
});

bot.callbackQuery("edit_back", async (ctx) => {
  await ctx.answerCallbackQuery();
  const item = pendingStore.peek(ctx.chat!.id);
  if (item) item.waitingFor = undefined;
  await showCurrent(ctx.chat!.id);
});

const EDIT_FIELDS: Record<string, { field: NonNullable<PendingModeration["waitingFor"]>; prompt: string }> = {
  edit_artist: { field: "artist", prompt: "Введите нового артиста:" },
  edit_title: { field: "title", prompt: "Введите новое название:" },
  edit_genre: { field: "genre", prompt: "Введите жанр:" },
  edit_version: { field: "version", prompt: "Введите тип/версию:" },
};
for (const [cb, { field, prompt }] of Object.entries(EDIT_FIELDS)) {
  bot.callbackQuery(cb, async (ctx) => {
    await ctx.answerCallbackQuery();
    const item = pendingStore.peek(ctx.chat!.id);
    if (!item) return showCurrent(ctx.chat!.id);
    item.waitingFor = field;
    await ctx.reply(prompt);
  });
}

// ─── Publish ─────────────────────────────────────────────────────────────────
bot.callbackQuery("publish", async (ctx) => {
  await ctx.answerCallbackQuery();
  const chatId = ctx.chat!.id;
  const item = pendingStore.peek(chatId);
  if (!item) return showCurrent(chatId);

  await ctx.reply("⏳ Публикую…");
  try {
    const result = await publishTrack(item);
    await reportDecision(item.submissionId, {
      decision: "published",
      trackId: result.trackId,
      slug: result.slug,
    });
    await cleanup(item);
    pendingStore.advance(chatId);
    await ctx.reply(`✅ Опубликовано: ${result.studioUrl}`);
    await showCurrent(chatId);
  } catch (err) {
    console.error("[moderation] publish failed:", err);
    await ctx.reply(
      `❌ Ошибка публикации: ${err instanceof Error ? err.message : String(err)}\n` +
        "Заявка сохранена — можно повторить.",
      { reply_markup: buildPreviewKeyboard() },
    );
  }
});

// ─── Reject ──────────────────────────────────────────────────────────────────
bot.callbackQuery("reject", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply("Причина отказа:", { reply_markup: buildRejectKeyboard() });
});

bot.callbackQuery("reject_custom", async (ctx) => {
  await ctx.answerCallbackQuery();
  const item = pendingStore.peek(ctx.chat!.id);
  if (!item) return showCurrent(ctx.chat!.id);
  item.waitingFor = "reject_reason";
  await ctx.reply("Введите причину отказа:");
});

bot.callbackQuery(/^reject_reason_(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const code = ctx.match![1];
  const reason = REJECT_REASONS.find((r) => r.code === code)?.label ?? "Отклонено";
  await finalizeReject(ctx.chat!.id, reason, (t) => ctx.reply(t));
});

async function finalizeReject(
  chatId: number,
  reason: string,
  reply: (text: string) => Promise<unknown>,
): Promise<void> {
  const item = pendingStore.peek(chatId);
  if (!item) {
    await reply("Нет активной заявки.");
    return;
  }
  try {
    await reportDecision(item.submissionId, { decision: "rejected", reason });
    await cleanup(item);
    pendingStore.advance(chatId);
    await reply(`❌ Заявка отклонена. Причина: ${reason}`);
    await showCurrent(chatId);
  } catch (err) {
    console.error("[moderation] reject failed:", err);
    await reply(`Ошибка отправки решения на сайт: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ─── Text input (edit values / custom reject reason) ─────────────────────────
bot.on("message:text", async (ctx) => {
  const chatId = ctx.chat.id;
  const item = pendingStore.peek(chatId);
  if (!item?.waitingFor) return;

  const field = item.waitingFor;
  item.waitingFor = undefined;
  const value = ctx.message.text.trim();

  if (field === "reject_reason") {
    await finalizeReject(chatId, value, (t) => ctx.reply(t));
    return;
  }

  if (field === "artist") item.artist = value;
  else if (field === "title") item.title = value;
  else if (field === "version") item.version = value;
  else if (field === "genre") {
    item.genre = value;
    item.artworkPath = await getArtworkPath(value);
  }

  await showCurrent(chatId);
});

bot.catch((err) => {
  console.error(
    `[moderation-bot] Unhandled error on update ${err.ctx.update.update_id}:`,
    err.error,
  );
  err.ctx.reply("⚠️ Внутренняя ошибка. Попробуйте ещё раз.").catch(() => {});
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function start(): Promise<void> {
  startIngestServer(bot, adminChatId);
  while (true) {
    try {
      console.log("[moderation-bot] started, polling for updates...");
      await bot.start();
      break;
    } catch (err) {
      if (err instanceof GrammyError && err.error_code === 409) {
        console.log("[moderation-bot] 409 conflict, retrying in 15s...");
        await sleep(15_000);
      } else {
        throw err;
      }
    }
  }
}

void start();
