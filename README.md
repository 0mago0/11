# 企業規程資料庫（Policy Center）

企業內部使用的規程管理系統。系統目前提供繁體中文、日文規程內容，涵蓋全社基本、人事、IT 管理、總務、營業管理、會計管理、EHS、進出口管理、COW 與 ISO9001。可管理草稿、版本、差異、送審、兩層承認、預定發布與修改紀錄。

> 前端現在以瀏覽器 `localStorage` 保存示範資料；Express API 與 PostgreSQL schema 已完成，供下一階段切換為多人共用資料庫使用。

## 快速開始

### 必要環境

- Node.js 22.3.0 以上
- npm
- PostgreSQL 16 以上（只有啟動後端 API 時需要）

### 啟動前端

```bash
npm install
npm run dev
```

本機網址通常是 <http://localhost:5173>。終端機若顯示不同網址，請以終端機顯示者為準。

### 啟動後端 API

```bash
cp backend/.env.example backend/.env
# 編輯 backend/.env，填入正確的 DATABASE_URL（系統資料一律使用 role_web schema）
psql "$DATABASE_URL" -f backend/db/postgresql_schema.sql
npm run api:dev
```

API 預設網址是 <http://localhost:3001>。前端目前尚未改為呼叫 API，因此可分別啟動、逐步串接。

### 登入測試帳號

啟動前端與後端後，先由登入頁登入。預設測試帳號如下：

| 角色 | 員工編號 | 密碼 |
| --- | --- | --- |
| Admin | `A0001` | `admin123` |
| Employee | `A0002` | `employee123` |
| 部門長 | `A0003` | `department123` |
| 據點長 | `A0004` | `site123` |

測試密碼可在 `backend/.env` 覆寫，請勿在正式環境使用預設密碼。

若資料庫是在更新前建立的，請在 pgAdmin 的目標資料庫 Query Tool 執行 [backend/db/demo_users.sql](backend/db/demo_users.sql)，補齊上述四個帳號與角色。Vite 前端預設使用 `http://localhost:5173`；也可使用 `http://127.0.0.1:5173`。開發環境的後端已允許這兩個網址。若自行設定 `NODE_ENV=production`，請將實際前端網址填入 `backend/.env` 的 `CORS_ORIGIN`，以逗號分隔。

若資料庫已在「改訂紀錄」功能加入前建立，請另外執行 [backend/db/add_revision_record.sql](backend/db/add_revision_record.sql) 一次；它只會新增欄位，不會刪除或覆蓋既有規程資料。

### 由 Excel 與 PDF 批次匯入規程

可使用 [tools/import_policies.py](tools/import_policies.py) 將多筆規程建立為 PostgreSQL 的「草稿」。匯入不會直接發布、不會覆蓋既有規程，也不會略過部門長與據點長承認。

匯入工具只讀取 Excel 欄位與 PDF 的一般文字／條文；**不會匯入圖片，也不會建立網頁表格**。PDF 中可辨識的表格列（Tab、`|` 或連續欄位空白）會略過。PDF 文字層若無法區分表格和一般文字，該列仍可能以純文字帶入，請在草稿編輯頁刪除即可。

先安裝 Python 3.10 以上與匯入工具所需套件：

```bash
python -m pip install -r tools/requirements.txt
python tools/import_policies.py --create-template policy_import.xlsx
```

打開 `policy_import.xlsx` 後，每一列填寫一筆規程。必要欄位為：

| 欄位 | 用途 | 範例 |
| --- | --- | --- |
| `policy_code` | 規程編號，須符合分類前綴 | `DHT2-0001` |
| `category_code` | 分類代碼 | `hr` |
| `title_zh` | 純 Excel 內文時的中文規程名稱；使用 PDF 時可留白，會由檔名讀取 | `就業規程` |
| `content_zh`／`pdf_zh` | 中文內文或中文 PDF 路徑，二擇一即可 | `DHT2-0001_zh.pdf` |
| `title_ja`、`content_ja`／`pdf_ja` | 日文名稱與日文內文或 PDF；有日文版本時填寫 | `就業規則` |
| `effective_date` | 生效日，格式 `YYYY-MM-DD` | `2026-09-01` |
| `revision_date`、`revision_content` | 單筆改訂紀錄（相容舊格式） | `2026-09-01`、`新制定` |
| `revision_records` | 多筆改訂紀錄；每行為 `YYYY-MM-DD｜改訂內容` | `2026-09-01｜新制定` |
| `revision_reason` | 僅 Admin、部門長、據點長可看的改訂理由 | `新規程初版` |
| `scheduled_publish_date` | 承認後的預定發布日；可留白 | `2026-09-01` |
| `created_by` | 建立者員編；可留白，預設 `A0001` | `A0001` |

`pdf_zh`、`pdf_ja` 可填 PDF 檔名或相對路徑。使用 PDF 時，檔名必須是 `規程編號_規程名稱_語言.pdf`，例如 `DHT2-0001＿就業規程＿中文.pdf`、`DHT2-0001＿就業規則＿日文.pdf`；可使用半形 `_` 或全形 `＿`。工具會由檔名自動取得規程名稱，並核對 Excel 的規程編號與語言。以下假設 Excel 與 PDF 都放在 `import-files` 資料夾：

```bash
# 先預覽並檢查欄位、日期、PDF 是否能讀取；不寫入資料庫
python tools/import_policies.py --excel import-files/policy_import.xlsx --pdf-dir import-files

# 確認預覽無誤後，實際建立草稿
python tools/import_policies.py --excel import-files/policy_import.xlsx --pdf-dir import-files --apply
```

完整操作順序：

1. 將 PDF 放到 `import-files`，例如 `DHT2-0001＿就業規程＿中文.pdf`、`DHT2-0001＿就業規則＿日文.pdf`。
2. 用 `--create-template` 產生 Excel 範本，填寫規程編號、分類與 PDF 檔名；使用 PDF 時不需要填寫規程名稱，也不需要填寫表格或圖片欄位。
3. 先執行未加 `--apply` 的預覽指令，確認每筆規程、PDF 路徑、日期都正確。
4. 加上 `--apply` 建立資料庫草稿。
5. 以 Admin 登入網頁，確認純文字內容、補上需要的網頁表格或圖片，再送交承認。

工具會讀取 `DATABASE_URL` 環境變數並固定寫入 `role_web` schema。若在 Windows PowerShell 執行，可先設定：

```powershell
$env:DATABASE_URL = "postgresql://帳號:密碼@localhost:5432/資料庫名稱"
python tools/import_policies.py --excel .\import-files\policy_import.xlsx --pdf-dir .\import-files --apply
```

PDF 必須是可選取文字的 PDF。掃描型 PDF 沒有文字層時，請先用 OCR 轉成可搜尋 PDF；工具會停止該次匯入並指出檔案，避免建立空白內文。

`revision_records` 優先於 `revision_date`、`revision_content` 使用。Excel 儲存格可用 `Alt + Enter` 換行，填寫多筆改訂紀錄，例如：

```text
2026-09-01｜新制定
2026-10-01｜第 2 條文字修正
```

這些改訂紀錄會在網頁的 Admin、承認者與 Employee 規程閱覽畫面中顯示。

### 日後串接公司登入 API

登入邏輯集中在 `backend/server/auth.js` 的 `authenticateWithCompanyApi()`。正式串接時：

1. 在 `backend/.env` 設定 `AUTH_PROVIDER=company_api`。
2. 在 `authenticateWithCompanyApi(account, password)` 呼叫公司 SSO／登入 API。
3. 讓該函式回傳公司驗證後的 `{ employeeNo }`。

系統會再以員編從本資料庫讀取角色與權限，因此前端登入頁、規程權限與承認流程不需要修改。

### 常用指令

| 指令 | 說明 |
| --- | --- |
| `npm run dev` | 啟動前端開發伺服器。 |
| `npm run build` | 建置前端正式版本。 |
| `npm run api:dev` | 以監看模式啟動 Express API。 |
| `npm run api:start` | 啟動 Express API。 |
| `npm run lint` | 檢查前後端程式碼風格。 |

後端必須持續運行，預定發布排程才會執行。排程以 `Asia/Taipei` 日期判定，發布者會在修改紀錄中標示為 `System`。

## 用 PM2 部署到 Linux 伺服器

以下範例假設網站放在 `/var/www/role_web`、前端使用 `3000` 埠、Express API 使用 `3001` 埠，並由 Nginx 對外提供 HTTPS。PM2 會讓兩個服務在 SSH 中斷、程式異常或伺服器重新開機後仍能持續運作。

> 請在 Linux 伺服器執行下列指令；不要在 pgAdmin 的 SQL Query Tool 中執行。部署前請先確認 PostgreSQL 已建立資料庫並已執行 `backend/db/postgresql_schema.sql`。

### 1. 安裝 Node.js、PM2 與專案套件

```bash
# 需先安裝 Node.js 22.3.0 以上與 Git；Ubuntu 可用 nvm 或 NodeSource 安裝。
node -v

sudo npm install -g pm2
git clone <你的 Git 儲存庫網址> /var/www/role_web
cd /var/www/role_web
npm ci
```

若不是透過 Git 部署，請將整個專案上傳到 `/var/www/role_web`，同樣在該目錄執行 `npm ci`。`node_modules`、`.env` 和資料庫密碼都不應上傳到 Git。

### 2. 設定正式環境變數

建立 `backend/.env`：

```env
DATABASE_URL=postgresql://policy_app:請改成強密碼@127.0.0.1:5432/policy_center
PGOPTIONS=-c search_path=role_web,public
PORT=3001
CORS_ORIGIN=https://policy.example.com
AUTH_PROVIDER=company_api
```

建立 `frontend/.env.production`：

```env
VITE_POLICY_API_URL=https://policy.example.com/api
```

`CORS_ORIGIN` 必須是使用者實際開啟前端的網址，不能保留 `localhost`。若先以測試帳號驗收，可暫時將 `AUTH_PROVIDER=demo`，並在 `backend/.env` 自行設定四個 `DEMO_*_PASSWORD` 密碼。

### 3. 建置前端並建立 PM2 設定檔

```bash
cd /var/www/role_web
npm run build
```

專案根目錄已附上 `ecosystem.config.cjs`。它的 `cwd: __dirname` 會自動使用設定檔所在的專案根目錄，因此不用因部署路徑不同而修改；內容如下：

```js
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
```

前端的 `vite preview` 會讀取 `npm run build` 產生的靜態檔案，因此每次更新前端程式碼都要先重新建置。API 不需要監看模式，PM2 會在程式意外結束時自動重啟。

### 4. 以 PM2 啟動、檢查與開機自啟

```bash
cd /var/www/role_web
pm2 start ecosystem.config.cjs
pm2 status
pm2 logs policy-api
pm2 logs policy-web

# 測試 API 是否正常
curl http://127.0.0.1:3001/health

# 儲存目前服務，並依 PM2 顯示的指令設定開機自啟
pm2 save
pm2 startup
```

`pm2 startup` 會輸出一行需要用 `sudo` 執行的指令；請完整複製並執行，之後再執行一次 `pm2 save`。常用維護指令如下：

| 指令 | 用途 |
| --- | --- |
| `pm2 status` | 查看服務是否為 `online`。 |
| `pm2 logs policy-api` | 查看後端、資料庫連線與排程紀錄。 |
| `pm2 logs policy-web` | 查看前端靜態網站服務紀錄。 |
| `pm2 restart policy-api` | 修改後端或 `.env` 後重啟 API。 |
| `pm2 restart policy-web` | 重新建置前端後重啟網站。 |
| `pm2 reload ecosystem.config.cjs --update-env` | 以設定檔平滑重載並重新讀取環境變數。 |

### 5. 用 Nginx 對外提供網站與 API

不建議直接對外開放 3000、3001 埠。Nginx 讓前端與 API 共用同一個 HTTPS 網域，前端使用 `/api` 呼叫 Express，因而不需要跨網域設定。

建立 `/etc/nginx/sites-available/policy-center`：

```nginx
server {
    listen 80;
    server_name policy.example.com;

    # 上線後請用 Certbot 將此站改為 HTTPS。
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

啟用並檢查 Nginx：

```bash
sudo ln -s /etc/nginx/sites-available/policy-center /etc/nginx/sites-enabled/policy-center
sudo nginx -t
sudo systemctl reload nginx
```

取得 HTTPS 憑證（網域 DNS 已指向此伺服器後）：

```bash
sudo certbot --nginx -d policy.example.com
```

### 6. 日後更新流程

```bash
cd /var/www/role_web
git pull
npm ci
npm run build
pm2 restart policy-api --update-env
pm2 restart policy-web --update-env
pm2 save
```

更新 PostgreSQL schema 前，先備份資料庫並在測試環境驗證。若 schema 有新增 migration，請先執行 migration，再重新啟動 API；不要在正式資料庫直接任意重跑會刪除資料的 SQL。

### PostgreSQL schema：`role_web`

本系統的 PostgreSQL 資料一律放在 `role_web` schema，不使用 `public` 存放規程、使用者、版本、承認或修改紀錄資料。`backend/db/postgresql_schema.sql` 開頭會自動建立 `role_web` 並切換至該 schema；Express API 也會透過 `PGOPTIONS` 固定使用 `role_web,public` 搜尋路徑。

以 pgAdmin 初始化時，請在目標資料庫的 Query Tool 執行整份 `backend/db/postgresql_schema.sql`。執行後可在 pgAdmin 展開：`Schemas` → `role_web` → `Tables`，確認 `policies`、`policy_versions`、`policy_change_requests` 等資料表都位於 `role_web` 下。

若資料庫管理者與 API 連線帳號不同，請以 schema 擁有者執行下列授權；將 `policy_app` 改成實際 API 帳號：

```sql
GRANT USAGE ON SCHEMA role_web TO policy_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA role_web TO policy_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA role_web TO policy_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA role_web
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO policy_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA role_web
GRANT USAGE, SELECT ON SEQUENCES TO policy_app;
```

如果先前曾在 `public` 建立本系統資料表，請不要直接重跑初始化 SQL，以免和既有物件衝突。先備份資料庫，再將既有資料表與相依物件移轉至 `role_web`，或在新的資料庫執行此初始化檔後匯入資料。

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
3. 據點長承認後，若發布日期尚未到達，狀態為「已承認待發布」；Node 後端會在台灣時間每天 00:05 自動發布，到期後也會在後端重啟時補跑一次。
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
├── frontend/                         # React / Vite SPA 前端（不使用 SSR）
│   ├── app/
│   │   ├── page.tsx                  # 首頁容器：資料狀態與工作流程
│   │   └── globals.css               # 全站與元件樣式
│   ├── components/
│   │   ├── pages/                    # 資料庫、待辦、修改紀錄頁外框
│   │   └── policy/                   # 可重用的表格、條文章節編輯元件
│   ├── public/
│   │   └── policy-mascot.png         # 左上角企業規程庫吉祥物圖標
│   ├── lib/
│   │   ├── policy-types.ts           # 前端資料型別定義
│   │   └── policy-utils.ts           # 編號、內容、表格與版本工具函式
│   ├── index.html                    # Vite 的網頁入口與瀏覽器標題
│   ├── main.tsx                      # React 瀏覽器掛載入口
│   └── vite.config.ts                # Vite SPA 開發及建置設定
├── backend/                          # Node.js / Express / PostgreSQL 後端
│   ├── server/
│   │   ├── index.js                  # API 路由與承認流程
│   │   ├── auth.js                   # 員編驗證及角色授權中介層
│   │   ├── db.js                     # PostgreSQL 連線池與交易工具
│   │   └── validation.js             # Zod 請求資料驗證規則
│   ├── db/
│   │   └── postgresql_schema.sql     # 正式 PostgreSQL schema、觸發器及 view
│   ├── docs/express-api.md           # API 請求／回應範例
│   └── .env.example                  # 後端環境變數範本
├── ecosystem.config.cjs              # PM2 正式環境服務設定範例
└── package.json                      # 共用指令與套件
```

## 介面圖標與字體

- 左上角的「企業規程庫」標誌使用 `frontend/public/policy-mascot.png`。它是綠色系、手持核可文件的吉祥物，會在規程資料庫、承認待辦與修改紀錄三個頁面共用顯示。
- 圖標透過 `frontend/app/page.tsx` 中的 `<img className="brand-mark" src="/policy-mascot.png" />` 載入；靜態檔案位於 `public/`，因此瀏覽器路徑固定為 `/policy-mascot.png`。
- `frontend/app/globals.css` 的 `.brand-mark` 控制圖標尺寸（35 × 35px）、圓形外框與裁切方式。若要替換圖標，保留相同檔名即可；若改用其他檔名，需同步修改三處左上角品牌區塊的 `src`。
- 全站採用較圓潤的字體優先順序：`JF Open Huninn`、`PingFang TC`、`Hiragino Maru Gothic ProN`、`Yu Gothic` 與 `Microsoft JhengHei`。裝置沒有前述字體時會自動使用後備字體。

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

左上角的品牌標誌在規程資料庫、承認待辦與修改紀錄三個畫面各有一個共用的 `<img className="brand-mark" />`。三者皆指向 `/policy-mascot.png`，避免換頁後圖標不一致。

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
| `backend/server/auth.js` | 提供測試登入帳號與可替換的公司 API 登入接點；從登入員編載入角色，再以 `requireRole()` 限制管理者與承認者。 |
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
- 部署前請執行 `npm run build`，並以 `npm run lint` 和實際登入／送審流程驗收。

## 建議維護順序

1. 新增資料欄位：先更新 `frontend/lib/policy-types.ts` 與 PostgreSQL schema。
2. 調整編輯功能：更新 `StructureEditor.tsx` 或 `Tables.tsx`，再修改 `page.tsx` 的草稿保存流程。
3. 調整權限：先修改 `backend/server/auth.js`，再同步更新前端角色顯示規則。
4. 變更工作流：集中調整 `page.tsx` 的送審／承認函式與 `backend/server/index.js` 的對應 API，並新增 audit 事件。
