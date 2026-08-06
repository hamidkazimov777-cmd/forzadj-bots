import { fetch } from "undici";
import { FORZADJ_API_URL } from "../shared/config.js";

/**
 * Колбэк статуса модерации на сайт: /api/submissions/<id>/moderate. Сайт
 * обновляет статус заявки и уведомляет пользователя. Auth — x-bot-secret
 * (MODERATION_API_SECRET, совпадает с сайтом).
 */
export async function reportDecision(
  submissionId: string,
  decision:
    | { decision: "published"; trackId: string; slug?: string }
    | { decision: "rejected"; reason: string },
): Promise<void> {
  const secret = process.env.MODERATION_API_SECRET;
  if (!secret) throw new Error("MODERATION_API_SECRET is not set");

  const res = await fetch(
    `${FORZADJ_API_URL.replace(/\/$/, "")}/api/submissions/${submissionId}/moderate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-bot-secret": secret,
      },
      body: JSON.stringify(decision),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Site moderate callback failed: HTTP ${res.status} ${text}`);
  }
}
