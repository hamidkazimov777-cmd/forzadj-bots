import { InlineKeyboard } from "grammy";
import type { PendingModeration } from "./pending.js";

/** Текст карточки заявки для администратора. */
export function buildPreviewText(
  item: PendingModeration,
  pos?: number,
  total?: number,
): string {
  const queueLabel =
    pos !== undefined && total !== undefined && total > 1 ? ` (${pos}/${total})` : "";

  const lines: string[] = [
    `📥 Заявка на публикацию${queueLabel}`,
    "",
    `Artist:  ${item.artist || "—"}`,
    `Title:   ${item.title || "—"}`,
    `Version: ${item.version || "—"}`,
    `Genre:   ${item.genre || "—"}`,
    `BPM:     ${item.bpm ?? "—"}`,
    `Key:     ${item.key || "—"}`,
    `Artwork: ${item.artworkPath ? `✅ ${item.genre}` : "⚠️ не найдена"}`,
  ];

  if (item.description) lines.push("", `Описание: ${item.description}`);
  if (item.author) lines.push(`Автор: ${item.author}`);
  if (item.contacts) lines.push(`Контакты: ${item.contacts}`);
  if (item.socials?.length) lines.push(`Соцсети: ${item.socials.join(", ")}`);

  lines.push(
    "",
    `👤 От: ${item.submitter.name}${item.submitter.telegram ? ` (${item.submitter.telegram})` : ""}`,
  );

  return lines.join("\n");
}

/** Основная клавиатура: Edit / Publish / Reject. */
export function buildPreviewKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("✏️ Edit", "edit")
    .text("✅ Publish", "publish")
    .row()
    .text("❌ Reject", "reject");
}

export function buildEditKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("👤 Artist", "edit_artist")
    .text("🎵 Title", "edit_title")
    .row()
    .text("🎸 Genre", "edit_genre")
    .text("🔀 Version", "edit_version")
    .row()
    .text("« Back", "edit_back");
}

/** Причины отказа (последняя — ввод вручную). */
export const REJECT_REASONS: { code: string; label: string }[] = [
  { code: "copyright", label: "Нарушение авторских прав" },
  { code: "quality", label: "Низкое качество звука" },
  { code: "duplicate", label: "Дубликат / уже в каталоге" },
  { code: "format", label: "Не соответствует формату пула" },
  { code: "content", label: "Запрещённый контент" },
];

export function buildRejectKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const r of REJECT_REASONS) {
    kb.text(r.label, `reject_reason_${r.code}`).row();
  }
  kb.text("✍️ Ввести причину", "reject_custom").row();
  kb.text("« Back", "edit_back");
  return kb;
}
