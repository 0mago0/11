# Express API

後端位於 `backend/server/`，使用 Node.js、Express 與 PostgreSQL 的 `pg` 驅動。先建立資料庫並執行 `backend/db/postgresql_schema.sql`，再複製 `backend/.env.example` 為 `backend/.env` 並填入 `DATABASE_URL`。

啟動：

```bash
npm run api:dev
```

目前開發階段以 HTTP Header `X-Employee-No: A0000` 驗證使用者。資料庫中的 `users` 與 `user_roles` 是唯一授權來源；正式環境應由 SSO／JWT 驗證後設定此身分，而非讓瀏覽器直接指定 Header。

| 方法 | 路徑 | 權限 | 用途 |
| --- | --- | --- | --- |
| GET | `/health` | 公開 | PostgreSQL 健康檢查 |
| GET | `/api/me` | 登入 | 目前使用者與角色 |
| GET | `/api/categories` | 登入 | 固定分類與 DHT 前綴 |
| GET | `/api/policies` | 登入 | 搜尋／讀取規程；Employee 僅取得發布版 |
| GET | `/api/policies/:policyCode` | 登入 | 規程與版本資料 |
| POST | `/api/policies` | Admin | 建立新規程及草稿 |
| POST | `/api/policies/:policyCode/changes` | Admin | 建立修訂草稿 |
| POST | `/api/change-requests/:id/submit` | Admin | 送交部門長承認 |
| GET | `/api/approval-queue` | 部門長／據點長 | 僅取得自己的待辦 |
| POST | `/api/change-requests/:id/approve` | 部門長／據點長 | 依關卡承認 |
| POST | `/api/change-requests/:id/return` | 部門長／據點長 | 退回修改並寫入意見 |
| POST | `/api/change-requests/:id/publish` | Admin | 直接發布純錯字修改 |
| POST | `/api/system/publish-scheduled` | Admin／排程服務 | 發布到期的已承認待發布案件 |
| GET | `/api/policies/:policyCode/audit-logs` | 登入 | 讀取修改紀錄，可用 `?action=` 篩選 |

據點長承認、純錯字直接發布與排程發布都會在同一筆資料庫交易中：建立不可覆蓋的新版本、寫入中日文內容、更新目前公開版本、更新送審狀態，並記錄稽核紀錄。
