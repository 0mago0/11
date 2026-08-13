import vinext from "vinext";
import { defineConfig } from "vite";

// 純 Node.js / PM2 模式：不使用 Cloudflare Worker、D1 或 Sites 外掛。
export default defineConfig({
  plugins: [vinext()],
});
