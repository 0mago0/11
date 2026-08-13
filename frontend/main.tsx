import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Home from "./app/page";
import "./app/globals.css";

// 純瀏覽器入口：登入後的規程資料仍由 Express API + PostgreSQL 取得。
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Home />
  </StrictMode>,
);
