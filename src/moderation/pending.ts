/**
 * Очередь заявок на модерацию, ожидающих решения администратора. По одному
 * чату администратора — очередь заявок (аналогично боту публикации). Заявка
 * приходит из сайта через HTTP-ingest.
 */

export interface Submitter {
  userId: string;
  name: string;
  telegram?: string;
}

export interface PendingModeration {
  submissionId: string;
  // Аудио заявки во временном файле.
  filePath: string;
  fileName: string;
  mimeType: string;
  // Метаданные (правятся администратором перед публикацией).
  title: string;
  artist: string;
  /** Тип/версия работы (Remix/Edit/…); передаётся как `version` в /api/bot/upload. */
  version: string;
  genre: string;
  bpm?: number;
  key?: string;
  // Справочная информация от пользователя (не редактируется, только показ).
  description?: string;
  author?: string;
  contacts?: string;
  socials?: string[];
  submitter: Submitter;
  // Брендовая обложка по жанру.
  artworkPath: string | null;
  // Черновик причины отказа / ожидание ввода.
  waitingFor?: "artist" | "title" | "genre" | "version" | "reject_reason";
}

const store = new Map<number, PendingModeration[]>();

export const pendingStore = {
  push(chatId: number, item: PendingModeration): number {
    const q = store.get(chatId) ?? [];
    q.push(item);
    store.set(chatId, q);
    return q.length;
  },
  peek(chatId: number): PendingModeration | undefined {
    return store.get(chatId)?.[0];
  },
  size(chatId: number): number {
    return store.get(chatId)?.length ?? 0;
  },
  /** Снять текущую заявку, вернуть следующую (или undefined). */
  advance(chatId: number): PendingModeration | undefined {
    const q = store.get(chatId);
    if (!q || q.length === 0) return undefined;
    q.shift();
    if (q.length === 0) {
      store.delete(chatId);
      return undefined;
    }
    return q[0];
  },
  /** Найти заявку по submissionId во всех очередях (на случай рассинхрона). */
  findBySubmission(submissionId: string): { chatId: number; item: PendingModeration } | undefined {
    for (const [chatId, q] of store.entries()) {
      const item = q.find((i) => i.submissionId === submissionId);
      if (item) return { chatId, item };
    }
    return undefined;
  },
};
