import { Bot, GrammyError } from "grammy";
import { requireEnv } from "../shared/config.js";
import { authMiddleware } from "../shared/auth.js";

/**
 * Бот поддержки (@forza_sup_bot).
 *
 * Обращения из формы Support на сайте доставляются напрямую через Bot API
 * (сайт использует SUPPORT_BOT_TOKEN) — этот процесс отвечает за присутствие
 * бота (команды, доступ) и задел под ответы администратора. Никакой доставки
 * тикетов здесь дублировать не нужно.
 */

const token = requireEnv("SUPPORT_BOT_TOKEN");
const bot = new Bot(token);

bot.use(authMiddleware);

bot.command("start", (ctx) =>
  ctx.reply(
    "🛟 Бот поддержки ForzaDJ.\n\nОбращения приходят сюда из формы Support на сайте: " +
      "контакты пользователя, категория, сообщение, вложения, дата и ID обращения.",
  ),
);

bot.catch((err) => {
  console.error(
    `[support-bot] Unhandled error on update ${err.ctx.update.update_id}:`,
    err.error,
  );
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function start(): Promise<void> {
  while (true) {
    try {
      console.log("[support-bot] started, polling for updates...");
      await bot.start();
      break;
    } catch (err) {
      if (err instanceof GrammyError && err.error_code === 409) {
        console.log("[support-bot] 409 conflict, retrying in 15s...");
        await sleep(15_000);
      } else {
        throw err;
      }
    }
  }
}

void start();
