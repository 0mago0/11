# 企業規程資料庫（Policy Center）

企業內部使用的規程管理系統。系統目前提供繁體中文、日文規程內容，涵蓋全社基本、人事、IT 管理、總務、營業管理、會計管理、EHS、進出口管理、COW 與 ISO9001。可管理草稿、版本、差異、送審、兩層承認、預定發布與修改紀錄。

> 前端現在以瀏覽器 `localStorage` 保存示範資料；Express API 與 PostgreSQL schema 已完成，供下一階段切換為多人共用資料庫使用。

## 快速開始

### 必要環境

- Node.js 22 以上
- npm
- PostgreSQL 16 以上（只有啟動後端 API 時需要）

### 啟動前端

```bash
npm install
npm run dev
```

本機網址通常是 <http://localhost:3000>。終端機若顯示不同網址，請以終端機顯示者為準。

### 啟動後端 API

```bash
cp backend/.env.example backend/.env
# 編輯 backend/.env，填入正確的 DATABASE_URL
psql "$DATABASE_URL" -f backend/db/postgresql_schema.sql
npm run api:dev
```

API 預設網址是 <http://localhost:3001>。前端目前尚未改為呼叫 API，因此可分別啟動、逐步串接。

### 常用指令

| 指令 | 說明 |
| --- | --- |
| `npm run dev` | 啟動前端開發伺服器。 |
| `npm run build` | 建置前端正式版本。 |
| `npm run api:dev` | 以監看模式啟動 Express API。 |
| `npm run api:start` | 啟動 Express API。 |
| `npm run db:generate` | 依 Drizzle schema 產生資料庫遷移檔。 |
| `npm run lint` | 檢查前後端程式碼風格。 |

## 功能與權限

| 角色 | 可做的事 |
| --- | --- |
| Employee | 只可查看已發布規程。 |
| Admin | 建立、編輯、儲存草稿、送審、發布錯字修正、停用規程、查看修改紀錄。 |
| 部門長 | 只看到「待部門長承認」的案件，以日文優先檢閱、承認或退回。 |
| 據點長 | 只看到「待據點長承認」的案件，以日文優先檢閱、承認或退回。 |

### 主要流程

1. Admin 建立規程或編輯草稿。
2. 新規程與內容修改送交部門長承認，再送交據點長。
3. 據點長承認後，若發布日期尚未到達，狀態為「已承認待發布」；到期後由排程或 Admin 發布。
4. 純錯字修正的已發布規程可由 Admin 直接發布；已承認待發布的錯字修正沿用既有承認。
5. 每次發布均建立不可覆蓋的版本快照，並寫入修改紀錄。

## 規程編號與分類

規程編號固定為 `DHTx-0000`：前綴由分類決定，後四碼由使用者輸入。使用者主鍵為員編，格式 `A0000`。

| 分類 | 前綴 |
| --- | --- |
| 全社基本 | `DHT1` |
| 人事 | `DHT2` |
| IT管理 | `DHT3` |
| 總務 | `DHT3` |
| 營業管理 | `DHT4` |
| 會計管理 | `DHT5` |
| EHS | `DHT6` |
| 進出口管理 | `DHT7` |
| COW | `DHT10` |
| ISO9001 | `DHT99` |

## 專案結構

```text
role_web/
├── frontend/                         # React / vinext 前端
│   ├── app/
│   │   ├── page.tsx                  # 首頁容器：資料狀態與工作流程
│   │   ├── globals.css               # 全站與元件樣式
│   │   ├── layout.tsx                # HTML metadata 與頁面外框
│   │   └── api/me/route.ts           # 前端登入角色示範 API
│   ├── components/
│   │   ├── pages/                    # 資料庫、待辦、修改紀錄頁外框
│   │   └── policy/                   # 可重用的表格、條文章節編輯元件
│   ├── lib/
│   │   ├── policy-types.ts           # 前端資料型別定義
│   │   └── policy-utils.ts           # 編號、內容、表格與版本工具函式
│   ├── worker/index.ts               # Cloudflare Worker 進入點
│   ├── vite.config.ts                # Vite / Cloudflare 開發及建置設定
│   └── .openai/hosting.json          # 網站發布設定
├── backend/                          # Node.js / Express / PostgreSQL 後端
│   ├── server/
│   │   ├── index.js                  # API 路由與承認流程
│   │   ├── auth.js                   # 員編驗證及角色授權中介層
│   │   ├── db.js                     # PostgreSQL 連線池與交易工具
│   │   └── validation.js             # Zod 請求資料驗證規則
│   ├── db/
│   │   ├── postgresql_schema.sql     # 正式 PostgreSQL schema、觸發器及 view
│   │   ├── schema.ts                 # Drizzle schema
│   │   └── index.ts                  # Drizzle 資料庫設定
│   ├── docs/express-api.md           # API 請求／回應範例
│   └── .env.example                  # 後端環境變數範本
└── package.json                      # 共用指令與套件
```

## 前端檔案與函式說明

### `frontend/app/page.tsx`

此檔案是流程容器，負責載入本機資料、角色切換、草稿保護、承認工作流與畫面選擇。可重用的編輯元件已移至 `components/policy/`；共用型別與工具規格位於 `lib/`。

| 函式／區塊 | 說明 |
| --- | --- |
| `normalizePolicy()` | 將舊資料補齊預設欄位、正規化編號及雙語內容，避免 localStorage 舊資料造成錯誤。 |
| `splitLegacyUpdatePolicies()` | 將舊格式的「停用待更新」資料拆為原發布卡與新的內容更新卡。 |
| `saveStore()` | 同步更新 React state 與 `localStorage` 的 `hr-policy-v8`。 |
| `changePreviewRole()` | 儲存角色預覽設定，並讓部門長／據點長自動切換日文界面。 |
| `open()` | 切換目前規程、建立可編輯的草稿副本與預設差異比較版本。 |
| `saveDraft()` | 儲存草稿；必要時建立獨立的內容更新規程卡。 |
| `publishTypoFix()` | 將純錯字修正直接建立新版，不經承認流程。 |
| `submitForApproval()` | 將草稿送交部門長，並處理原版與內容更新卡的狀態。 |
| `departmentApprove()` | 部門長承認後，移交據點長。 |
| `siteApprove()` | 據點長承認後立即發布，或改成已承認待發布。 |
| `returnForRevision()` | 退回案件並記錄退回者及意見。 |
| `restore()` | 將歷史版本複製回草稿，從不覆蓋舊版。 |
| `guardEditingNavigation()` | 編輯未儲存時攔截換頁、切換分類或規程，詢問是否先儲存。 |

### `frontend/components/`

| 檔案 | 說明 |
| --- | --- |
| `policy/Tables.tsx` | 顯示與編輯規程表格；可新增／刪除表格、列、欄，並在儲存格直接輸入。 |
| `policy/StructureEditor.tsx` | 編輯章節與條文；條號由系統新增，使用者只輸入條文內容。 |
| `pages/PolicyLibraryPage.tsx` | 規程資料庫頁的外框，統一套用未儲存草稿保護。 |
| `pages/ApprovalPage.tsx` | 承認待辦頁的外框。 |
| `pages/AuditPage.tsx` | 修改紀錄頁的外框。 |

### `frontend/lib/`

| 檔案 | 重要內容 |
| --- | --- |
| `policy-types.ts` | `Policy`、`Version`、`Copy`、`Approval`、`Audit` 等資料契約。新增欄位時先調整此處。 |
| `policy-utils.ts` | `policyCode()` 統一產生 DHT 編號；`normalizeTables()` 防止非陣列表格錯誤；`chaptersFromContent()` / `contentFromChapters()` 轉換條文結構；`clone()` 建立不共用參考的草稿。 |

## 後端 API 與資料庫

完整 API 範例請閱讀 [backend/docs/express-api.md](backend/docs/express-api.md)。所有 `/api/*` 呼叫須帶入 header：

```http
X-Employee-No: A0000
```

| 位置 | 職責 |
| --- | --- |
| `backend/server/auth.js` | 從 header 讀取員編、驗證使用者是否啟用，再以 `requireRole()` 限制管理者與承認者。 |
| `backend/server/db.js` | 建立 `pg.Pool`，以 `withTransaction()` 確保一個發布或承認動作全部成功或全部回滾。 |
| `backend/server/validation.js` | 用 Zod 驗證 DHT 編號、雙語內容、建立規程與修改草稿的請求內容。 |
| `backend/server/index.js` | REST 路由、建立修改申請、兩階段承認、預定發布、退回與 audit 寫入。 |
| `backend/db/postgresql_schema.sql` | 建立分類、使用者、規程、版本、翻譯、修改申請、承認、通知與稽核表；版本及稽核表有防覆寫觸發器。 |

### 核心 API 路由

| 方法 | 路徑 | 角色 | 用途 |
| --- | --- | --- | --- |
| `GET` | `/health` | 無 | 檢查後端與資料庫連線。 |
| `GET` | `/api/me` | 任一登入者 | 取得員編、姓名與角色。 |
| `GET` | `/api/policies` | 任一登入者 | 搜尋規程；Employee 僅取得已發布資料。 |
| `POST` | `/api/policies` | Admin | 新增規程與初始修改申請。 |
| `POST` | `/api/policies/:policyCode/changes` | Admin | 建立草稿、錯字或內容修改。 |
| `POST` | `/api/change-requests/:id/submit` | Admin | 送交部門長承認。 |
| `GET` | `/api/approval-queue` | 部門長／據點長 | 取得該角色應承認的案件。 |
| `POST` | `/api/change-requests/:id/approve` | 部門長／據點長 | 完成自己的承認階段。 |
| `POST` | `/api/change-requests/:id/return` | 部門長／據點長 | 退回並保留意見。 |
| `POST` | `/api/change-requests/:id/publish` | Admin | 發布已承認的案件。 |
| `GET` | `/api/policies/:policyCode/audit-logs` | Admin | 查詢單一規程修改紀錄。 |

## 資料保存與正式上線注意事項

- 前端示範資料使用 `localStorage`，鍵名為 `hr-policy-v8`，不同電腦／瀏覽器不會同步。
- 正式環境請以 Express API + PostgreSQL 為唯一資料來源，並移除前端的示範資料寫入。
- `policy_versions`、翻譯與稽核紀錄在 PostgreSQL 中設有不可修改／刪除保護，確保舊版本不會被覆蓋。
- `.env` 不應提交到 Git；請只提交 `.env.example`。
- 部署前請執行 `npm run build`。舊的 `npm test` 仍是初始化範本的 loading-skeleton 測試，與目前完成的介面不相符，不應作為功能驗收依據。

## 建議維護順序

1. 新增資料欄位：先更新 `frontend/lib/policy-types.ts` 與 PostgreSQL schema。
2. 調整編輯功能：更新 `StructureEditor.tsx` 或 `Tables.tsx`，再修改 `page.tsx` 的草稿保存流程。
3. 調整權限：先修改 `backend/server/auth.js`，再同步更新前端角色顯示規則。
4. 變更工作流：集中調整 `page.tsx` 的送審／承認函式與 `backend/server/index.js` 的對應 API，並新增 audit 事件。
