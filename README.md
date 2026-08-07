# ForzaDJ Bots

Telegram bots for the **[ForzaDJ](https://forzadj.ru)** DJ-pool ecosystem —
moderation of user-submitted tracks and a support inbox. Built with
[grammY](https://grammy.dev) and TypeScript, deployed on Railway.

🌐 **Live site:** https://forzadj.ru

---

## What's inside

One Node process runs **both bots** plus an HTTP ingest endpoint:

- **Moderation bot** (`@forzadj_creator_bot`) — receives user track submissions
  from the site via an HTTP ingest, sends the admin the playable audio + a review
  card (**Edit / Publish / Reject**). On *Publish* the track is published through
  the site's existing publish endpoint (`POST /api/bot/upload`) — publishing logic
  is **not duplicated** here. The decision is reported back to the site, which
  updates the submission status and notifies the user.
- **Support bot** (`@forza_sup_bot`) — support inbox; tickets are delivered from
  the site directly via the bot token.

```
Site  →  POST /ingest (audio + metadata)  →  Moderation bot
      →  admin reviews (Edit / Publish / Reject)
      →  Publish → site /api/bot/upload → catalog
      →  status callback → site updates & notifies the user
```

## Tech stack

TypeScript · grammY · undici · Node HTTP · Railway (NIXPACKS)

## Project structure

```
src/
├── index.ts              # Combined entrypoint (both bots + ingest)
├── shared/               # allowlist auth + env config
├── support/index.ts      # Support bot
└── moderation/           # Moderation bot: ingest, preview, publish, callbacks
assets/artwork/           # Branded genre cover art
```

## Getting started

```bash
npm install
cp .env.example .env      # fill in tokens & secrets
npm run build
npm start                 # runs both bots + ingest
```

Dev: `npm run dev`. See `.env.example` for all required variables
(bot tokens, shared secrets with the site, `FORZADJ_API_URL`).

## Deployment

Auto-deployed to **Railway** on push to `main` (`railway.json`). The moderation
ingest listens on `0.0.0.0:$PORT` and is reachable via the service's public domain.

## Related

- **Website:** https://forzadj.ru
- Part of the ForzaDJ ecosystem (site + publication bot + these bots).

---

© 2026 ForzaDJ. All rights reserved. Published for reference; not licensed for reuse.
