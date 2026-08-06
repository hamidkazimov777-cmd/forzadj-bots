import "dotenv/config";

/** Разбор списка разрешённых Telegram ID из ALLOWED_TELEGRAM_IDS. */
function parseAllowedIds(raw: string | undefined): Set<number> {
  const ids = new Set<number>();
  if (!raw) return ids;
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const id = Number(trimmed);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error(
        `Invalid Telegram user ID "${trimmed}" in ALLOWED_TELEGRAM_IDS.`,
      );
    }
    ids.add(id);
  }
  return ids;
}

const allowedIds = parseAllowedIds(process.env.ALLOWED_TELEGRAM_IDS);

export function isAllowedTelegramUser(userId: number): boolean {
  return allowedIds.has(userId);
}

/** Обязательная переменная окружения — падаем на старте, если не задана. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Error: ${name} is missing. Set it in the environment.`);
    process.exit(1);
  }
  return value;
}

export const FORZADJ_API_URL =
  process.env.FORZADJ_API_URL ?? "https://forzadj.ru";
