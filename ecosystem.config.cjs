/**
 * PM2 正式環境設定。
 * cwd 使用此檔案所在的專案根目錄，部署到任何絕對路徑都不需修改。
 */
module.exports = {
  apps: [
    {
      name: "policy-api",
      cwd: __dirname,
      script: "backend/server/index.js",
      interpreter: "node",
      env: { NODE_ENV: "production" },
      autorestart: true,
      max_restarts: 10,
      time: true,
    },
    {
      name: "policy-web",
      cwd: __dirname,
      script: "node_modules/vite/bin/vite.js",
      args: "preview --port 3000 --host 127.0.0.1",
      interpreter: "node",
      env: { NODE_ENV: "production" },
      autorestart: true,
      max_restarts: 10,
      time: true,
    },
  ],
};
