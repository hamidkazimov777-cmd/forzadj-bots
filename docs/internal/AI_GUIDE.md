# AI_GUIDE.md — правила для ИИ-ассистентов (forzadj-bots: боты модерации и поддержки)

> **Читай ПЕРВЫМ, затем `HANDOFF.md`.** Оба — до любого изменения.
> Для любых ассистентов (Gemini, GPT/Codex, Kimi и т.д.).

## 0. Грабли, которые ломают этот сервис

1. **Нужен Node ≥ 22 (из-за `undici@8`).** `undici@8` при загрузке вызывает
   `worker_threads.markAsUncloneable`, которого НЕТ в Node 20 → краш
   «webidl.util.markAsUncloneable is not a function». Сейчас сервис работает,
   потому что `nixpacks`-дефолт Node — 22. **НЕ пинуй Node 20** (ни в
   `nixpacks.toml`, ни в `.nvmrc`, ни в `engines`). Если пинишь версию — только
   `22`. (Ровно на этом падал соседний `forzadj-admin-bot`.)
2. **Один инстанс на токен.** У модерации и поддержки — свои Telegram-токены.
   Два процесса с одним токеном → `409 Conflict`. Не запускай дубликаты
   параллельно с продакшеном (Railway — единственный дом).
3. **Пакетный менеджер — npm** (`railway.json`: `npm install && npm run build`,
   `npm start`). Держи `package-lock.json`. НЕ добавляй `pnpm-lock.yaml` —
   двойной lock-файл ломает автодетект в Nixpacks.
4. **Всегда `git push` сразу после `git commit`** — Railway деплоит из GitHub.

## 1. Что это за сервис
- Один Railway-сервис `forzadj-bots` (`dist/index.js`) поднимает **оба** бота:
  - **Модерация** `@forzadj_creator_bot`: HTTP-ingest принимает заявку с сайта
    (секрет `MODERATION_INGEST_SECRET`) → шлёт админу аудио + кнопки
    **Edit / Publish / Reject**.
  - **Поддержка** `@forza_sup_bot`: доставка тикетов по `SUPPORT_BOT_TOKEN`.
- Публичный домен: `https://forzadj-bots-production.up.railway.app`.

## 2. Ключевые правила логики
- **Publish публикует через сайтовый `POST /api/bot/upload`** (заголовок
  `x-bot-secret` = `FORZADJ_BOT_SECRET` == сайтовый `BOT_UPLOAD_SECRET`).
  **НЕ дублируй логику публикации** — она одна на сайте. Reject → колбэк на сайт
  (`MODERATION_API_SECRET`).
- Брендовые обложки по жанру — те же, что у сайта/бота публикации. Не плоди
  свой набор/свою функцию вшивания.
- Секреты — только в Railway → Variables, никогда в код/git/логи.

## 3. Процесс
- Read-first (этот файл + `HANDOFF.md`). Проверяй, что файлы/функции существуют,
  прежде чем править. Не выдумывай API. Маленькими шагами, один concern на коммит.
- Перед «готово»: `npm run build` (tsc) проходит; `HANDOFF.md` обновлён;
  секреты не утекли. Не уверен — спроси.

## 4. Шаблон промта (человеку — в начало запроса ИИ)
```
Проект forzadj-bots (боты модерации @forzadj_creator_bot и поддержки
@forza_sup_bot). Перед действием прочитай AI_GUIDE.md и HANDOFF.md и следуй им.
Node ≥22 (не пинить 20); один инстанс на токен (иначе 409); пакетный менеджер
npm (не добавлять pnpm-lock); публикация только через сайтовый /api/bot/upload
(не дублировать); всегда push после commit; перед «готово» — tsc-сборка проходит
и HANDOFF обновлён. Не выдумывай API, работай маленькими шагами, не уверен — спроси.
Задача: <...>
```
