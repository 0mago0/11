# 企業規程資料庫（Policy Center）

這是一個用於管理企業各類規程的網站。使用者可以搜尋與閱讀規程，建立或編輯規程內容，保留歷史版本、比較版本差異，並以繁體中文與日文分別維護內容。規程編輯區支援可直接輸入文字的表格。規程分類包含全社基本、人事、IT管理、總務、營業管理、會計管理、EHS、進出口管理、COW 與 ISO9001。

## 使用方式

```bash
npm install
npm run dev
```

完成修改後，可用下列指令確認網站能正常建置：

```bash
npm run build
```

## 主要功能

- 規程瀏覽：以「全部規程」及十個固定分類專屬頁面瀏覽、搜尋與閱讀規程；每個分類均提供一筆中日雙語的已發布示範規程。新增規程會自動歸屬目前開啟的分類頁。
- 規程編號：各分類有固定前綴，格式為「前綴-四位數字」，例如人事 `DHT2-0001`；編輯時僅需輸入後四位數字。IT 管理與總務共用 `DHT3` 前綴。
- 承認待辦示範：IT 管理、EHS 與會計管理各提供一筆待承認案件，可用部門長／據點長角色檢視原文、差異與承認流程。
- 新增與編輯：新增規程或調整既有規程，儲存時自動產生新版本。
- 版本管理：查看每次儲存的歷史內容，並將舊版還原成一個新的版本。
- 差異比較：選取兩個版本，標示文字的新增與刪除。
- 多語言：同一份規程可分別編輯繁體中文與日文內容。
- 表格編輯：新增表格，直接在儲存格輸入文字，並可增加列、欄或刪除表格。

## 資料保存方式

目前規程資料以瀏覽器的 `localStorage` 保存，鍵名為 `hr-policies-v5`。這表示資料保存在目前使用的瀏覽器與裝置中；不同電腦或瀏覽器之間不會自動同步。資料結構更新時會換用新的鍵名，以避免舊資料被錯誤解讀。

若未來需要多人共用、權限控管或跨裝置同步，應改用正式資料庫作為資料來源。

## PostgreSQL 資料庫設計

可直接執行 [backend/db/postgresql_schema.sql](backend/db/postgresql_schema.sql) 建立 PostgreSQL 結構。此設計已涵蓋規程、公開版本、雙語內容、條文／表格 JSON 結構、送審草稿、兩階段承認、附件、關聯規程、通知與不可竄改的修改紀錄。

- `policies.policy_code` 是規程主鍵，格式固定為 `DHT1-0000` 至 `DHT99-0000`；資料庫會比對所屬分類的固定前綴。
- `users.employee_no` 是使用者主鍵，格式固定為 `A0000`。
- `policy_versions`、`policy_version_translations` 與 `policy_audit_logs` 設有不可修改／刪除觸發器，符合舊版本不可覆蓋的要求。
- `employee_published_policies` 視圖只回傳發布中的最新版本，供 Employee 權限使用。

## Node.js／Express 後端 API

後端原始碼位於 `backend/server/`，使用 Express 與 PostgreSQL `pg` 驅動，API 說明見 [backend/docs/express-api.md](backend/docs/express-api.md)。設定 `backend/.env` 後可用 `npm run api:dev` 啟動；目前前端仍使用本機資料，下一步可改由前端呼叫此 API。

## 前後端資料夾結構

| 資料夾 | 用途 |
| --- | --- |
| `frontend/` | 網頁介面、樣式、Cloudflare Worker、前端測試與網站發布設定。 |
| `backend/` | Express API、PostgreSQL schema、資料庫設定與 API 文件。 |

## 檔案與資料夾說明

| 位置 | 用途 |
| --- | --- |
| `frontend/app/page.tsx` | 網站的主要頁面與規程管理互動。 |
| `frontend/app/globals.css` | 前端全站樣式。 |
| `frontend/public/` | 網站圖示等靜態檔案。 |
| `frontend/worker/index.ts` | Cloudflare Worker 前端進入點。 |
| `frontend/vite.config.ts` | Vite、vinext 與 Cloudflare 前端設定。 |
| `frontend/.openai/hosting.json` | 網站發布設定與專案 ID。 |
| `backend/server/index.js` | Express API 進入點。 |
| `backend/server/auth.js` | 員編驗證與角色權限中介層。 |
| `backend/server/db.js` | PostgreSQL 連線池與交易輔助。 |
| `backend/server/validation.js` | API 輸入與 DHT 編號驗證。 |
| `backend/db/postgresql_schema.sql` | PostgreSQL schema、索引、觸發器與公開視圖。 |
| `backend/docs/express-api.md` | 後端 API 文件。 |
| `backend/.env.example` | 後端環境變數範本。 |
| `package.json` | 共用套件與前端／後端啟動指令。 |

## `frontend/app/page.tsx` 詳解

### 資料型別

| 型別／函式            | 用途                                                                            |
| --------------------- | ------------------------------------------------------------------------------- |
| `Lang`                | 語言代碼，只允許 `zh`（繁體中文）或 `ja`（日文）。                              |
| `TableBlock`          | 一個規程表格，包含唯一 `id` 與二維 `cells` 陣列；每個字串就是一個儲存格的內容。 |
| `Copy`                | 單一語言的規程內容：標題、摘要、全文與表格清單。                                |
| `Version`             | 規程的一次歷史快照，含版本號、日期、說明與中日雙語內容。                        |
| `Policy`              | 一份完整規程，含編號、分類、生效日、狀態及所有版本。                            |
| `c()`                 | 建立一個 `Copy` 物件的簡寫函式。                                                |
| `v()`                 | 建立一個 `Version` 物件的簡寫函式。                                             |
| `seed`                | 首次開啟網站時使用的示範規程資料。                                              |
| `current(policy)`     | 回傳該規程最後一筆版本，也就是目前生效的內容。                                  |
| `nextVersion(number)` | 將次版本號加一，例如 `3.2` 變成 `3.3`。                                         |
| `blank()`             | 建立一份空白草稿規程，供「新增規程」按鈕使用。                                  |

### 畫面元件

| 元件           | 用途                                                                       |
| -------------- | -------------------------------------------------------------------------- |
| `PolicyTables` | 閱讀模式的表格顯示元件。第一列會以表頭樣式呈現。                           |
| `TableEditor`  | 編輯模式的表格工具。提供新增表格、直接打字、新增列、新增欄與刪除表格功能。 |
| `Home`         | 主頁元件，負責清單、閱讀、編輯、版本紀錄、版本比較及語言切換。             |

### `Home` 的主要狀態

| 狀態                | 用途                                           |
| ------------------- | ---------------------------------------------- |
| `items`             | 所有規程資料。                                 |
| `selectedId`        | 目前正在閱讀或編輯的規程 ID。                  |
| `lang`              | 目前畫面顯示與編輯的語言。                     |
| `query`、`category` | 搜尋文字與分類篩選條件。                       |
| `editing`           | 控制目前是閱讀模式還是編輯模式。               |
| `draft`             | 編輯中的暫存規程；取消編輯時不會寫回正式資料。 |
| `modal`             | 控制版本紀錄或差異比較視窗是否開啟。           |
| `compare`           | 差異比較時所選的舊版與新版索引。               |
| `notice`            | 儲存或還原成功時顯示的短暫通知。               |

### `Home` 的主要函式

| 函式                       | 做什麼                                                                   |
| -------------------------- | ------------------------------------------------------------------------ |
| `persist(next)`            | 更新畫面上的規程資料，並同步寫入瀏覽器儲存空間。                         |
| `open(policy)`             | 選取一份規程，切回閱讀模式並關閉版本視窗。                               |
| `updateCopy(field, value)` | 更新目前語言的標題、摘要、全文或表格；修改只會先存在 `draft`。           |
| `save(event)`              | 送出編輯表單。既有規程會遞增版本號並保留新快照；新規程則建立第一版。     |
| `restore(version)`         | 把指定歷史版本複製成最新版本，不會覆蓋或刪除原有紀錄。                   |
| `diff(oldText, newText)`   | 將兩段全文拆成段落，比對後回傳相同、刪除與新增的項目，用於差異比較視窗。 |

### `TableEditor` 的主要函式

| 函式                                | 做什麼                             |
| ----------------------------------- | ---------------------------------- |
| `add()`                             | 新增預設 2 列 × 3 欄的表格。       |
| `update(table, row, column, value)` | 在使用者輸入時更新指定儲存格文字。 |
| `addRow(table)`                     | 在指定表格尾端增加一列空白儲存格。 |
| `addCol(table)`                     | 在指定表格右側增加一欄空白儲存格。 |

## 常用指令

| 指令                  | 用途                                      |
| --------------------- | ----------------------------------------- |
| `npm run dev`         | 啟動本機開發網站。                        |
| `npm run build`       | 建置並檢查正式部署版本。                  |
| `npm test`            | 執行範本測試。                            |
| `npm run db:generate` | 未來變更後端資料庫結構時產生 Drizzle 遷移檔。 |

## 維護建議

1. 修改規程功能時，優先調整 `frontend/app/page.tsx` 的資料型別與 `save()` 流程，確保每次修改都能正確建立版本。
2. 新增可保存的欄位時，應同時更新 `Copy` 或 `Policy` 型別、`blank()` 預設資料，以及編輯／閱讀兩種畫面。
3. 調整表格外觀時，在 `frontend/app/globals.css` 搜尋 `policy-table`、`table-editor` 或 `editable-table`。
4. 要支援多人同步，將目前前端 `localStorage` 邏輯改為呼叫 `backend/server/` 的 Express API。
