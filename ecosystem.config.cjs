// pm2-конфиг для ботов ForzaDJ на VPS. Запуск: pm2 start ecosystem.config.cjs
// Требует предварительной сборки: npm ci && npm run build (создаёт dist/).
module.exports = {
  apps: [
    {
      name: "forzadj-support",
      script: "dist/support/index.js",
      cwd: __dirname,
      env: { NODE_ENV: "production" },
      autorestart: true,
      max_restarts: 20,
    },
    {
      name: "forzadj-moderation",
      script: "dist/moderation/index.js",
      cwd: __dirname,
      env: { NODE_ENV: "production" },
      autorestart: true,
      max_restarts: 20,
    },
  ],
};
