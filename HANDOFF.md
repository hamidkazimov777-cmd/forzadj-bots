# HANDOFF.md — forzadj-bots

Единый источник состояния репозитория. Любой AI/разработчик читает это первым.
Обновлять после каждого завершённого шага, до git commit.

## Назначение

Два Telegram-бота экосистемы ForzaDJ, размещённые на **Railway** (один сервис,
один процесс запускает оба бота):

1. **Бот модерации `@forzadj_creator_bot`** — принимает пользовательские заявки
   на публикацию треков с сайта (через HTTP-ingest), показывает администратору
   аудио + карточку с кнопками **Edit / Publish / Reject**. По Publish публикует
   трек тем же способом, что и бот публикации (`POST /api/bot/upload` на сайте) —
   логика публикации НЕ дублируется. По Reject — причина. Решение отправляется на
   сайт колбэком, который меняет статус заявки и уведомляет пользователя.
2. **Бот поддержки `@forza_sup_bot`** — минимальный процесс присутствия.
   Обращения из формы Support доставляются в него напрямую с сайта по
   `SUPPORT_BOT_TOKEN` (запущенный процесс для доставки не требуется).

Существующий бот публикации (`forzadj-admin-bot`, отдельный репозиторий) НЕ
затрагивается.

## Структура

```
src/
├── index.ts                 # Комбинированный вход Railway: импортит оба бота
├── shared/
│   ├── config.ts            # allowlist (ALLOWED_TELEGRAM_IDS), requireEnv, FORZADJ_API_URL
│   └── auth.ts              # authMiddleware (только приват + allowlist)
├── support/index.ts         # Бот поддержки (grammy polling, /start)
└── moderation/
    ├── index.ts             # Бот модерации: старт ingest + polling + хендлеры Edit/Publish/Reject
    ├── ingest.ts            # HTTP-сервер приёма заявок (0.0.0.0:$PORT, /ingest, x-ingest-secret)
    ├── pending.ts           # Очередь заявок в памяти (Map по chatId)
    ├── preview.ts           # Карточка + клавиатуры (Edit/Publish/Reject, причины отказа)
    ├── publish.ts           # publishTrack → POST /api/bot/upload (undici, свежее соединение)
    ├── artwork.ts           # Брендовая обложка по жанру
    └── site.ts              # reportDecision → POST /api/submissions/[id]/moderate
assets/artwork/              # 13 брендовых PNG по жанрам (копия из forzadj-admin-bot)
```

## Поток данных

```
Сайт (submitTrackAction)
  → POST $MODERATION_INGEST_URL/ingest   (base64 MP3 + метаданные, x-ingest-secret)
  → бот модерации: sendAudio (проигрывается) + карточка Edit/Publish/Reject
  → [Publish] publishTrack → POST $FORZADJ_API_URL/api/bot/upload (x-bot-secret=FORZADJ_BOT_SECRET)
             → reportDecision {published, trackId} → сайт меняет статус + уведомляет юзера
  → [Reject] выбор/ввод причины → reportDecision {rejected, reason} → статус «Отклонён» + уведомление
```

## Развёртывание (Railway)

- Сервис в проекте `observant-strength`, автодеплой при push в `main`.
- `railway.json`: build `npm install && npm run build` (НЕ `npm ci` — EBUSY на
  кэш-mount `/app/node_modules/.cache`), start `npm start` (`node dist/index.js`).
- Публичный домен: `https://forzadj-bots-production.up.railway.app`.
- Ingest слушает `0.0.0.0:$PORT` (Railway PORT=8080) — `server.listen` использует
  переменную host, не хардкод (иначе снаружи 502).
- Bot API отдаёт файлы до ~50 МБ: `sendAudio` для больших файлов может упасть —
  обёрнут в try/catch, карточка всё равно уходит.

## Переменные окружения

- `ALLOWED_TELEGRAM_IDS` — админы (727850088)
- `FORZADJ_API_URL` — https://forzadj.ru
- `MODERATION_BOT_TOKEN`, `MODERATION_ADMIN_CHAT_ID`
- `MODERATION_INGEST_SECRET` — общий с сайтом (ingest auth)
- `MODERATION_API_SECRET` — общий с сайтом (колбэк статуса)
- `FORZADJ_BOT_SECRET` — == `BOT_UPLOAD_SECRET` сайта (публикация)
- `SUPPORT_BOT_TOKEN`, `SUPPORT_ADMIN_CHAT_ID`

## Правила

- Работать маленькими шагами, одна задача — один коммит.
- Production-ready код, без заглушек.
- Обновлять HANDOFF.md до коммита.
- Не коммитить секреты (`.env`).
- Логику публикации не дублировать — использовать `/api/bot/upload` сайта.
- Всегда `git push` после `git commit` (Railway деплоит из GitHub).
