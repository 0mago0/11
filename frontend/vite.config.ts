import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 純 Vite SPA：不使用 SSR、vinext、Cloudflare Worker 或 D1。
export default defineConfig({
  plugins: [react()],
});
