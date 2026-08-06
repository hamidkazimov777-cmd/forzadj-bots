import { Context, NextFunction } from "grammy";
import { isAllowedTelegramUser } from "./config.js";

/**
 * Контроль доступа: только приватные чаты и Telegram ID из allowlist.
 * Регистрируется перед всеми обработчиками.
 */
export async function authMiddleware(
  ctx: Context,
  next: NextFunction,
): Promise<void> {
  const chatType = ctx.chat?.type;
  const userId = ctx.from?.id;

  if (
    chatType !== "private" ||
    userId === undefined ||
    !isAllowedTelegramUser(userId)
  ) {
    await ctx.reply("⛔ Доступ запрещён.");
    return;
  }

  await next();
}
