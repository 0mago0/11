import "dotenv/config";
import express from "express";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { db, withTransaction } from "./db.js";
import { authenticate, isAdmin, requireRole, signIn } from "./auth.js";
import { changeDraft, policyCode, policyCreate } from "./validation.js";

const app = express();
const port = Number(process.env.PORT || 3001);
// CORS_ORIGIN 可填多個網域，以逗號分隔。Vite 開發模式預設使用 5173 埠，
// 因此非正式環境也允許 3000 / 5173 / 4173，避免瀏覽器擋掉登入請求。
const configuredCorsOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const developmentCorsOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:4173",
  // 使用者常直接開啟 Vite 顯示的 127.0.0.1 網址；它和 localhost 是不同 Origin，
  // 未列入時瀏覽器會擋住 API，畫面便會錯誤地維持本機假資料。
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:4173",
];
const allowedCorsOrigins = new Set([
  ...configuredCorsOrigins,
  ...(process.env.NODE_ENV === "production" ? [] : developmentCorsOrigins),
]);

app.use(express.json({ limit: "16mb" }));
app.use((req, res, next) => {
  const origin = req.header("Origin");
  if (!origin || allowedCorsOrigins.has(origin)) {
    // 沒有 Origin 的健康檢查／伺服器呼叫不需要 CORS header；有 Origin 時只回傳白名單內網址。
    if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Employee-No");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const parse = (schema, value) => {
  const result = schema.safeParse(value);
  if (!result.success) {
    const error = new Error("Validation failed.");
    error.status = 400;
    error.details = result.error.flatten();
    throw error;
  }
  return result.data;
};

// 所有工作流動作均呼叫此函式寫入稽核表，留下操作者、前後版本與退回意見。
const audit = async (client, { actor, policyCode: code, changeRequestId = null, action, fromVersionNo = null, toVersionNo = null, changedFields = [], beforeContent = null, afterContent = null, comment = null }) => {
  await client.query(
    `INSERT INTO policy_audit_logs
      (actor_employee_no, policy_code, change_request_id, action, from_version_no, to_version_no, changed_fields, before_content, after_content, comment)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10)`,
    [actor, code, changeRequestId, action, fromVersionNo, toVersionNo, JSON.stringify(changedFields), beforeContent && JSON.stringify(beforeContent), afterContent && JSON.stringify(afterContent), comment],
  );
};
// 舊資料的單筆改訂日／內容也會轉成清單第一筆，確保升級後不遺失既有改訂紀錄。
const revisionRecordsFor = (change) =>
  change.revisionRecords?.length || change.revision_records?.length
    ? (change.revisionRecords || change.revision_records)
    : change.revision_date || change.revisionDate || change.revision_content || change.revisionContent
      ? [{ date: change.revision_date || change.revisionDate || "", content: change.revision_content || change.revisionContent || "" }]
      : [];

// 規程版本與修改申請都採相同的中日文翻譯資料結構，因此共用寫入邏輯。
const insertTranslations = async (client, table, ownerColumn, ownerId, translations) => {
  for (const item of translations) {
    await client.query(
      `INSERT INTO ${table} (${ownerColumn}, language, title, summary, content, chapters, tables, images)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb)`,
      [ownerId, item.language, item.title, item.summary, item.content, JSON.stringify(item.chapters), JSON.stringify(item.tables), JSON.stringify(item.images || [])],
    );
  }
};

// 發布會新增 version（絕不更新舊 version）、更新規程狀態，並寫入 audit；呼叫端必須包在交易內。
const publishChangeRequest = async (client, change, actorEmployeeNo) => {
  const { rows: policyRows } = await client.query(
    "SELECT current_version_no FROM policies WHERE policy_code = $1 FOR UPDATE",
    [change.policy_code],
  );
  const policy = policyRows[0];
  if (!policy) throw new Error("Policy not found.");
  const versionNo = (policy.current_version_no || 0) + 1;
  const { rows: translations } = await client.query(
    `SELECT language, title, summary, content, chapters, tables, images
       FROM policy_change_translations WHERE change_request_id = $1`,
    [change.change_request_id],
  );
  if (!translations.length) {
    const error = new Error("A change request needs at least one translation before publishing.");
    error.status = 409;
    throw error;
  }
  await client.query(
    `INSERT INTO policy_versions (policy_code, version_no, effective_date, published_by, revision_note, revision_date, revision_content, revision_records, source_change_request_id)
     VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4, $5, COALESCE($6, CURRENT_DATE), $7, $8::jsonb, $9)`,
    [change.policy_code, versionNo, change.requested_effective_date, actorEmployeeNo, change.revision_reason, change.revision_date, change.revision_content, JSON.stringify(revisionRecordsFor(change)), change.change_request_id],
  );
  for (const item of translations) {
    await client.query(
      `INSERT INTO policy_version_translations (policy_code, version_no, language, title, summary, content, chapters, tables, images)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb)`,
      [change.policy_code, versionNo, item.language, item.title, item.summary, item.content, JSON.stringify(item.chapters), JSON.stringify(item.tables), JSON.stringify(item.images || [])],
    );
  }
  await client.query(
    `UPDATE policies SET status = 'published', current_version_no = $2, effective_date = COALESCE($3, effective_date), published_at = now(), updated_at = now()
      WHERE policy_code = $1`,
    [change.policy_code, versionNo, change.requested_effective_date],
  );
  await client.query(
    `UPDATE policy_change_requests SET status = 'published', published_at = now(), updated_at = now()
      WHERE change_request_id = $1`,
    [change.change_request_id],
  );
  await audit(client, {
    actor: actorEmployeeNo,
    policyCode: change.policy_code,
    changeRequestId: change.change_request_id,
    action: "published",
    fromVersionNo: change.base_version_no,
    toVersionNo: versionNo,
    changedFields: ["version", "translations", "status"],
  });
  return { policyCode: change.policy_code, versionNo };
};

/**
 * 發布所有已到期的預定案件。以資料庫的台灣日期判定，確保伺服器所在時區不影響發布日。
 * 此函式同時提供 HTTP 管理端點與伺服器排程使用，避免兩套發布邏輯不一致。
 */
const publishDueScheduledChanges = (actorEmployeeNo = 'A0000') =>
  withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM policy_change_requests
        WHERE status = 'approved_scheduled'
          AND scheduled_publish_date <= (now() AT TIME ZONE 'Asia/Taipei')::date
        FOR UPDATE`,
    );
    const results = [];
    for (const change of rows) {
      // A0000 是 schema 預留的 System 使用者，稽核紀錄可辨識為排程發布。
      results.push(await publishChangeRequest(client, change, actorEmployeeNo));
    }
    return results;
  });

/** 取得距離下一個台灣時間 00:05 的毫秒數。 */
const millisecondsUntilTaipeiDailyRun = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  let nextTaipeiRun = Date.UTC(
    Number(value.year), Number(value.month) - 1, Number(value.day),
    0, 5, 0,
  ) - (8 * 60 * 60 * 1000);
  if (nextTaipeiRun <= Date.now()) nextTaipeiRun += 24 * 60 * 60 * 1000;
  return Math.max(1_000, nextTaipeiRun - Date.now());
};

// 先補跑一次，避免伺服器停機後錯過發布日；再固定於台灣時間每天 00:05 執行。
const startScheduledPublisher = () => {
  const run = async () => {
    try {
      const published = await publishDueScheduledChanges();
      if (published.length) console.log(`Scheduled publisher released ${published.length} policy change(s).`);
    } catch (error) {
      console.error('Scheduled publisher failed:', error);
    }
  };
  void run();
  const scheduleNext = () => {
    setTimeout(async () => {
      await run();
      scheduleNext();
    }, millisecondsUntilTaipeiDailyRun());
  };
  scheduleNext();
};

app.get("/health", async (_req, res) => {
  await db.query("SELECT 1");
  res.json({ status: "ok" });
});

// 登入只回傳員工識別與角色；瀏覽器後續以員編作為 API 權限識別。
// 正式環境改用公司 API 時，登入頁與其他業務 API 不需改動。
app.post("/auth/login", async (req, res) => {
  const user = await signIn(req.body?.account, req.body?.password);
  if (!user) return res.status(401).json({ error: "帳號或密碼不正確。" });
  res.json({
    employeeNo: user.employee_no,
    name: user.display_name,
    role: user.roles[0] || "employee",
    roles: user.roles,
  });
});

app.use("/api", authenticate);

// PDF 僅擷取可選取的文字；掃描式 PDF 沒有文字層時會請使用者改用可搜尋 PDF。
// 必須放在 authenticate 後，否則 requireRole 讀取 req.user 時會沒有使用者資料。
const pdfBodyStart = /^\s*第\s*(?:[一二三四五六七八九十百千\d]+)\s*(?:章|條|条)/m;
const pdfTitleFromFileName = (fileName) => fileName
  .replace(/\.pdf$/i, "")
  .replace(/^DHT\d{1,2}-\d{4}[＿_]/i, "")
  .replace(/[＿_](?:中文|繁中|繁體中文|日文|日本語|zh(?:-TW)?|ja(?:-JP)?)$/i, "")
  .trim();
const revisionHeading = /(?:改訂|改定|修訂)(?:紀錄|記錄|履歴|履歷)/;
const revisionDatePattern = /((?:19|20)\d{2})\s*[./年-]\s*(\d{1,2})\s*(?:[./月-]\s*(\d{1,2}))?\s*(?:日)?/;
const normalizeRevisionDate = (match) => `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3] || "1").padStart(2, "0")}`;
// PDF 首頁的版次表格常有「改訂紀錄」欄。正文仍由第一章開始，但此欄會獨立帶入草稿改訂紀錄。
const revisionRecordsFromPdf = (allText) => {
  const records = [];
  let reading = false;
  for (const rawLine of allText.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const hasHeading = revisionHeading.test(line);
    if (hasHeading) reading = true;
    if (!reading) continue;
    if (pdfBodyStart.test(line) && !hasHeading) break;
    const date = line.match(revisionDatePattern);
    if (date) {
      const content = line.slice((date.index || 0) + date[0].length).replace(revisionHeading, "").replace(/^(?:改訂日|改定日|修訂日|內容|内容)[:：\s]*/i, "").trim();
      records.push({ date: normalizeRevisionDate(date), content });
    } else if (records.length && !/^(?:改訂日|改定日|修訂日|內容|内容)[:：\s]*$/i.test(line)) {
      const latest = records.at(-1);
      latest.content = `${latest.content}${latest.content ? "\n" : ""}${line}`;
    }
  }
  return records.filter((record, index, array) => record.date && array.findIndex((item) => item.date === record.date && item.content === record.content) === index);
};

app.post("/api/imports/pdf-draft", requireRole("admin"), async (req, res) => {
  const { fileName, dataUrl } = req.body || {};
  if (typeof fileName !== "string" || !/\.pdf$/i.test(fileName) || typeof dataUrl !== "string" || !/^data:application\/(?:pdf|x-pdf|octet-stream);base64,/i.test(dataUrl)) {
    const error = new Error("請上傳 PDF 檔案。"); error.status = 400; throw error;
  }
  const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) {
    const error = new Error("PDF 檔案需小於 10 MB。"); error.status = 400; throw error;
  }
  if (bytes.subarray(0, 5).toString() !== "%PDF-") {
    const error = new Error("上傳的檔案不是有效的 PDF。"); error.status = 400; throw error;
  }
  let pdf;
  try {
    pdf = await getDocument({ data: new Uint8Array(bytes) }).promise;
  } catch (cause) {
    const error = new Error(`PDF 無法讀取：${cause instanceof Error ? cause.message : "請確認檔案未加密或損毀。"}`);
    error.status = 422;
    throw error;
  }
  const pages = [];
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const text = await page.getTextContent();
    // pdf.js 依繪製項目回傳文字。利用同一條基線的 y 座標組成行，保留第一章、
    // 第一條等段落邊界，前端才可自動建立章節與條文。
    const lines = [];
    let currentLine = "";
    let previousY = null;
    for (const item of text.items) {
      if (!("str" in item) || !item.str) continue;
      const y = Array.isArray(item.transform) ? Math.round(item.transform[5] * 2) / 2 : previousY;
      if (previousY !== null && y !== null && Math.abs(y - previousY) > 2 && currentLine.trim()) {
        lines.push(currentLine.trim());
        currentLine = "";
      }
      // 中文／日文文字通常被拆成單字元；只有兩邊都是英數時才補空白，避免「第 一 條」。
      const needsSpace = /[A-Za-z0-9]$/.test(currentLine) && /^[A-Za-z0-9]/.test(item.str);
      currentLine += `${needsSpace ? " " : ""}${item.str}`;
      previousY = y;
    }
    if (currentLine.trim()) lines.push(currentLine.trim());
    pages.push(lines.join("\n"));
  }
  const allText = pages.join("\n").replace(/\s*\n\s*/g, "\n").trim();
  const revisionRecords = revisionRecordsFromPdf(allText);
  const start = allText.search(pdfBodyStart);
  const bodyWithPossibleRevision = (start >= 0 ? allText.slice(start) : allText).trim();
  // 改訂紀錄可能位於規程正文最後。偵測到後，後續資料僅屬於改訂紀錄，
  // 不可再送到前端章／節／條的自動結構辨識。
  const revisionStartInBody = bodyWithPossibleRevision.search(revisionHeading);
  const content = (revisionStartInBody >= 0
    ? bodyWithPossibleRevision.slice(0, revisionStartInBody)
    : bodyWithPossibleRevision).trim();
  if (!content) { const error = new Error("這份 PDF 找不到可讀取的文字內容，請使用可搜尋文字的 PDF。"); error.status = 422; throw error; }
  res.json({ title: pdfTitleFromFileName(fileName), content, foundPolicyBody: start >= 0, revisionRecords });
});

app.get("/api/me", (req, res) => res.json(req.user));

app.get("/api/categories", async (_req, res) => {
  const { rows } = await db.query("SELECT category_code, name_zh, name_ja, code_prefix, sort_order FROM policy_categories WHERE is_active = true ORDER BY sort_order");
  res.json(rows);
});

app.get("/api/policies", async (req, res) => {
  const { category, status, search, language = "zh-TW" } = req.query;
  const params = [language];
  const conditions = [];
  if (!isAdmin(req.user) && !req.user.roles.some((role) => ["department_head", "site_head"].includes(role))) conditions.push("p.status = 'published'");
  if (category) { params.push(category); conditions.push(`p.category_code = $${params.length}`); }
  if (status) { params.push(status); conditions.push(`p.status = $${params.length}`); }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(p.policy_code ILIKE $${params.length} OR t.title ILIKE $${params.length} OR t.content ILIKE $${params.length})`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await db.query(
    `SELECT p.policy_code, p.category_code, c.name_zh AS category_zh, p.status, p.effective_date, p.published_at, p.current_version_no,
            t.language, t.title, t.summary
       FROM policies p
       JOIN policy_categories c ON c.category_code = p.category_code
       LEFT JOIN policy_version_translations t ON t.policy_code = p.policy_code AND t.version_no = p.current_version_no AND t.language = $1
       ${where}
      ORDER BY p.updated_at DESC`, params,
  );
  res.json(rows);
});

app.get("/api/policies/:policyCode", async (req, res) => {
  const code = parse(policyCode, req.params.policyCode);
  // 分開查版本、翻譯與目前草稿，避免 JSON 聚合把歷史版本的翻譯資料混在一起。
  const { rows: policies } = await db.query(
    `SELECT p.*, c.name_zh AS category_zh, c.name_ja AS category_ja
       FROM policies p JOIN policy_categories c ON c.category_code = p.category_code
      WHERE p.policy_code = $1`, [code],
  );
  const policy = policies[0];
  if (!policy) return res.sendStatus(404);
  if (req.user.roles.includes("employee") && !isAdmin(req.user) && policy.status !== "published") return res.sendStatus(404);
  const { rows: versionRows } = await db.query(
    `SELECT version_no, published_at, revision_note, revision_date, revision_content, revision_records FROM policy_versions
      WHERE policy_code = $1 ORDER BY version_no`, [code],
  );
  const { rows: versionTranslations } = await db.query(
    `SELECT version_no, language, title, summary, content, chapters, tables, images
       FROM policy_version_translations WHERE policy_code = $1`, [code],
  );
  const { rows: changes } = await db.query(
    `SELECT change_request_id, status, change_kind, revision_reason, revision_date, revision_content, revision_records, scheduled_publish_date, submitted_at, approved_at
       FROM policy_change_requests WHERE policy_code = $1
        AND status NOT IN ('published', 'cancelled')
      ORDER BY updated_at DESC LIMIT 1`, [code],
  );
  const activeChange = changes[0] || null;
  const { rows: changeTranslations } = activeChange
    ? await db.query(
        `SELECT language, title, summary, content, chapters, tables, images
           FROM policy_change_translations WHERE change_request_id = $1`,
        [activeChange.change_request_id],
      )
    : { rows: [] };
  res.json({
    ...policy,
    versions: versionRows.map((version) => ({
      versionNo: version.version_no,
      publishedAt: version.published_at,
      revisionNote: version.revision_note,
      revisionDate: version.revision_date,
      revisionContent: version.revision_content,
      revisionRecords: revisionRecordsFor(version),
      translations: versionTranslations.filter((translation) => translation.version_no === version.version_no),
    })),
    activeChange: activeChange && {
      changeRequestId: activeChange.change_request_id,
      status: activeChange.status,
      changeKind: activeChange.change_kind,
      revisionReason: activeChange.revision_reason,
      revisionDate: activeChange.revision_date,
      revisionContent: activeChange.revision_content,
      revisionRecords: revisionRecordsFor(activeChange),
      scheduledPublishDate: activeChange.scheduled_publish_date,
      submittedAt: activeChange.submitted_at,
      approvedAt: activeChange.approved_at,
      translations: changeTranslations,
    },
  });
});

app.post("/api/policies", requireRole("admin"), async (req, res) => {
  const input = parse(policyCreate, req.body);
  const result = await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO policies (policy_code, category_code, status, effective_date, created_by)
       VALUES ($1, $2, 'disabled', $3, $4)`,
      [input.policyCode, input.categoryCode, input.effectiveDate || null, req.user.employee_no],
    );
    const { rows } = await client.query(
      `INSERT INTO policy_change_requests (policy_code, change_kind, revision_reason, revision_date, revision_content, revision_records, requested_effective_date, requires_approval, created_by)
       VALUES ($1, 'new_policy', $2, $3, $4, $5::jsonb, $6, true, $7) RETURNING change_request_id`,
      [input.policyCode, input.revisionReason, input.revisionDate || null, input.revisionContent, JSON.stringify(revisionRecordsFor(input)), input.effectiveDate || null, req.user.employee_no],
    );
    await insertTranslations(client, "policy_change_translations", "change_request_id", rows[0].change_request_id, input.translations);
    await audit(client, { actor: req.user.employee_no, policyCode: input.policyCode, changeRequestId: rows[0].change_request_id, action: "created", changedFields: ["policy", "translations", "revision_date", "revision_content", "revision_reason"], comment: input.revisionReason || null });
    return rows[0];
  });
  res.status(201).json(result);
});

app.post("/api/policies/:policyCode/changes", requireRole("admin"), async (req, res) => {
  const code = parse(policyCode, req.params.policyCode);
  const input = parse(changeDraft, req.body);
  const result = await withTransaction(async (client) => {
    const { rows: policies } = await client.query("SELECT * FROM policies WHERE policy_code = $1 FOR UPDATE", [code]);
    if (!policies[0]) { const error = new Error("Policy not found."); error.status = 404; throw error; }
    const requiresApproval = input.changeKind !== "typo";
    const { rows } = await client.query(
      `INSERT INTO policy_change_requests (policy_code, base_version_no, change_kind, revision_reason, revision_date, revision_content, revision_records, requested_effective_date, scheduled_publish_date, requires_approval, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11) RETURNING change_request_id, status`,
      [code, policies[0].current_version_no, input.changeKind, input.revisionReason, input.revisionDate || null, input.revisionContent, JSON.stringify(revisionRecordsFor(input)), input.requestedEffectiveDate || null, input.scheduledPublishDate || null, requiresApproval, req.user.employee_no],
    );
    await insertTranslations(client, "policy_change_translations", "change_request_id", rows[0].change_request_id, input.translations);
    await audit(client, { actor: req.user.employee_no, policyCode: code, changeRequestId: rows[0].change_request_id, action: "draft_saved", fromVersionNo: policies[0].current_version_no, changedFields: ["translations", "revision_date", "revision_content", "revision_reason"], comment: input.revisionReason || null });
    return rows[0];
  });
  res.status(201).json(result);
});

// 停用是正式的資料庫狀態異動，不能只由前端暫存；保留歷史版本但清空目前公開版指標。
app.post("/api/policies/:policyCode/disable", requireRole("admin"), async (req, res) => {
  const code = parse(policyCode, req.params.policyCode);
  const result = await withTransaction(async (client) => {
    const { rows } = await client.query(
      "SELECT * FROM policies WHERE policy_code = $1 FOR UPDATE",
      [code],
    );
    const policy = rows[0];
    if (!policy) return null;
    if (policy.status === "disabled") return { status: "disabled", alreadyDisabled: true };
    const previousVersionNo = policy.current_version_no;
    // 停用後保留最後公開版，讓歷史內容與後續更新申請仍有版本基準。
    await client.query(
      `UPDATE policies
          SET status = 'disabled',
              disabled_at = now(), disabled_by = $2, updated_at = now()
        WHERE policy_code = $1`,
      [code, req.user.employee_no],
    );
    await audit(client, {
      actor: req.user.employee_no,
      policyCode: code,
      action: "disabled",
      fromVersionNo: previousVersionNo,
      changedFields: ["status"],
    });
    return { status: "disabled", alreadyDisabled: false };
  });
  if (!result) return res.sendStatus(404);
  res.json(result);
});

// 草稿可重複儲存；送審中一律鎖定，確保承認者看到的內容不會在審查中途改變。
// 但「已承認待發布」的錯字修正沿用既有承認，可更新草稿內容並維持原發布日。
app.patch("/api/change-requests/:changeRequestId", requireRole("admin"), async (req, res) => {
  const input = parse(changeDraft, req.body);
  const result = await withTransaction(async (client) => {
    const { rows } = await client.query("SELECT * FROM policy_change_requests WHERE change_request_id = $1 FOR UPDATE", [req.params.changeRequestId]);
    const change = rows[0];
    if (!change) return null;
    const canEditApprovedScheduledTypo =
      change.status === 'approved_scheduled' && input.changeKind === 'typo';
    if (!['draft', 'returned_for_revision'].includes(change.status) && !canEditApprovedScheduledTypo) {
      const error = new Error("Only a draft, returned request, or approved scheduled typo change can be edited.");
      error.status = 409;
      throw error;
    }
    await client.query(
      `UPDATE policy_change_requests
          -- 新增規程的 base_version_no 必須永遠是 NULL。退回後前端雖以「內容修改」
          -- 編輯，但不能把它改成 content，否則會違反資料庫的版本基準檢查。
          SET change_kind = CASE WHEN change_kind = 'new_policy' THEN 'new_policy' ELSE $2::change_kind END,
              revision_reason = $3, revision_date = $4, revision_content = $5, revision_records = $6::jsonb,
              requested_effective_date = $7, scheduled_publish_date = $8,
              requires_approval = CASE WHEN change_kind = 'new_policy' THEN true ELSE $9 END,
              updated_at = now()
        WHERE change_request_id = $1`,
      [change.change_request_id, input.changeKind, input.revisionReason, input.revisionDate || null, input.revisionContent, JSON.stringify(revisionRecordsFor(input)), input.requestedEffectiveDate || null, input.scheduledPublishDate || null, input.changeKind !== 'typo'],
    );
    await client.query("DELETE FROM policy_change_translations WHERE change_request_id = $1", [change.change_request_id]);
    await insertTranslations(client, "policy_change_translations", "change_request_id", change.change_request_id, input.translations);
    await audit(client, { actor: req.user.employee_no, policyCode: change.policy_code, changeRequestId: change.change_request_id, action: "draft_saved", fromVersionNo: change.base_version_no, changedFields: ["translations", "revision_date", "revision_content", "revision_reason"], comment: input.revisionReason || null });
    return { change_request_id: change.change_request_id, status: change.status };
  });
  if (!result) return res.sendStatus(404);
  res.json(result);
});

// 僅未送審或已退回的草稿可刪除。既有規程只刪除該次草稿；新規程若尚無版本，則連同空的規程主檔移除。
app.delete("/api/change-requests/:changeRequestId", requireRole("admin"), async (req, res) => {
  const result = await withTransaction(async (client) => {
    const { rows } = await client.query("SELECT * FROM policy_change_requests WHERE change_request_id = $1 FOR UPDATE", [req.params.changeRequestId]);
    const change = rows[0];
    if (!change) return null;
    if (!['draft', 'returned_for_revision'].includes(change.status)) {
      const error = new Error("Only a draft or returned request can be deleted."); error.status = 409; throw error;
    }
    await client.query("DELETE FROM policy_change_requests WHERE change_request_id = $1", [change.change_request_id]);
    let deletedPolicy = false;
    if (change.change_kind === 'new_policy') {
      const { rows: remaining } = await client.query(
        `SELECT EXISTS (SELECT 1 FROM policy_versions WHERE policy_code = $1) AS has_version,
                EXISTS (SELECT 1 FROM policy_change_requests WHERE policy_code = $1) AS has_change`,
        [change.policy_code],
      );
      if (!remaining[0].has_version && !remaining[0].has_change) {
        // 完全未發布的新規程沒有可保留的歷史；先清除其建立／草稿稽核紀錄，
        // 才能依外鍵規則一併移除空的規程主檔。
        await client.query("DELETE FROM policy_audit_logs WHERE policy_code = $1", [change.policy_code]);
        await client.query("DELETE FROM policies WHERE policy_code = $1", [change.policy_code]);
        deletedPolicy = true;
      }
    }
    if (!deletedPolicy) {
      await audit(client, { actor: req.user.employee_no, policyCode: change.policy_code, action: "draft_saved", fromVersionNo: change.base_version_no, changedFields: ["draft_deleted"], comment: "草稿已刪除" });
    }
    return { policyCode: change.policy_code, deletedPolicy };
  });
  if (!result) return res.sendStatus(404);
  res.json(result);
});

app.post("/api/change-requests/:changeRequestId/submit", requireRole("admin"), async (req, res) => {
  const result = await withTransaction(async (client) => {
    const { rows } = await client.query("SELECT * FROM policy_change_requests WHERE change_request_id = $1 FOR UPDATE", [req.params.changeRequestId]);
    const change = rows[0];
    if (!change) return null;
    if (!["draft", "returned_for_revision"].includes(change.status)) { const error = new Error("Only a draft or returned request can be submitted."); error.status = 409; throw error; }
    if (!change.requires_approval) { const error = new Error("Typo changes use the direct publish endpoint."); error.status = 409; throw error; }
    await client.query("UPDATE policy_change_requests SET status = 'pending_department_head', submitted_at = now(), updated_at = now() WHERE change_request_id = $1", [change.change_request_id]);
    await client.query("DELETE FROM change_request_approvals WHERE change_request_id = $1", [change.change_request_id]);
    await client.query(`INSERT INTO change_request_approvals (change_request_id, approval_step, required_role) VALUES ($1, 1, 'department_head'), ($1, 2, 'site_head')`, [change.change_request_id]);
    await audit(client, { actor: req.user.employee_no, policyCode: change.policy_code, changeRequestId: change.change_request_id, action: "submitted" });
    return { changeRequestId: change.change_request_id, status: "pending_department_head" };
  });
  if (!result) return res.sendStatus(404);
  res.json(result);
});

app.get("/api/approval-queue", requireRole("department_head", "site_head"), async (req, res) => {
  const targetStatus = req.user.roles.includes("department_head") ? "pending_department_head" : "pending_site_head";
  const { rows } = await db.query(
    `SELECT cr.*, p.category_code, p.current_version_no,
            COALESCE(jsonb_agg(jsonb_build_object('language', ct.language, 'title', ct.title, 'summary', ct.summary, 'content', ct.content, 'chapters', ct.chapters, 'tables', ct.tables)) FILTER (WHERE ct.language IS NOT NULL), '[]') AS translations
       FROM policy_change_requests cr JOIN policies p ON p.policy_code = cr.policy_code
       LEFT JOIN policy_change_translations ct ON ct.change_request_id = cr.change_request_id
      WHERE cr.status = $1 GROUP BY cr.change_request_id, p.category_code, p.current_version_no
      ORDER BY cr.submitted_at ASC`, [targetStatus],
  );
  res.json(rows);
});

app.post("/api/change-requests/:changeRequestId/approve", requireRole("department_head", "site_head"), async (req, res) => {
  const result = await withTransaction(async (client) => {
    const { rows } = await client.query("SELECT * FROM policy_change_requests WHERE change_request_id = $1 FOR UPDATE", [req.params.changeRequestId]);
    const change = rows[0];
    if (!change) return null;
    const isDepartmentHead = req.user.roles.includes("department_head");
    const expectedStatus = isDepartmentHead ? "pending_department_head" : "pending_site_head";
    if (change.status !== expectedStatus) { const error = new Error("This request is not in your approval step."); error.status = 409; throw error; }
    const step = isDepartmentHead ? 1 : 2;
    const action = isDepartmentHead ? "department_approved" : "site_approved";
    await client.query(`UPDATE change_request_approvals SET decision = 'approved', decided_by = $2, decided_at = now(), comment = $3 WHERE change_request_id = $1 AND approval_step = $4`, [change.change_request_id, req.user.employee_no, req.body.comment || null, step]);
    if (isDepartmentHead) {
      await client.query("UPDATE policy_change_requests SET status = 'pending_site_head', updated_at = now() WHERE change_request_id = $1", [change.change_request_id]);
      await audit(client, { actor: req.user.employee_no, policyCode: change.policy_code, changeRequestId: change.change_request_id, action });
      return { status: "pending_site_head" };
    }
    const scheduled = change.scheduled_publish_date && new Date(change.scheduled_publish_date) > new Date(new Date().toDateString());
    await audit(client, { actor: req.user.employee_no, policyCode: change.policy_code, changeRequestId: change.change_request_id, action });
    if (!scheduled) {
      const published = await publishChangeRequest(client, change, req.user.employee_no);
      return { status: "published", publishNow: true, ...published };
    }
    await client.query(`UPDATE policy_change_requests SET status = 'approved_scheduled', approved_at = now(), updated_at = now() WHERE change_request_id = $1`, [change.change_request_id]);
    return { status: "approved_scheduled", publishNow: false };
  });
  if (!result) return res.sendStatus(404);
  res.json(result);
});

app.post("/api/change-requests/:changeRequestId/publish", requireRole("admin"), async (req, res) => {
  const result = await withTransaction(async (client) => {
    const { rows } = await client.query("SELECT * FROM policy_change_requests WHERE change_request_id = $1 FOR UPDATE", [req.params.changeRequestId]);
    const change = rows[0];
    if (!change) return null;
    if (change.change_kind !== "typo" || change.requires_approval || change.status !== "draft") {
      const error = new Error("Only a typo draft can be directly published.");
      error.status = 409;
      throw error;
    }
    return publishChangeRequest(client, change, req.user.employee_no);
  });
  if (!result) return res.sendStatus(404);
  res.json({ status: "published", ...result });
});

app.post("/api/system/publish-scheduled", requireRole("admin"), async (req, res) => {
  const published = await publishDueScheduledChanges(req.user.employee_no);
  res.json({ published });
});

app.post("/api/change-requests/:changeRequestId/return", requireRole("department_head", "site_head"), async (req, res) => {
  if (!req.body.comment?.trim()) return res.status(400).json({ error: "A return comment is required." });
  const result = await withTransaction(async (client) => {
    const { rows } = await client.query("SELECT * FROM policy_change_requests WHERE change_request_id = $1 FOR UPDATE", [req.params.changeRequestId]);
    const change = rows[0];
    if (!change) return null;
    const isDepartmentHead = req.user.roles.includes("department_head");
    if (change.status !== (isDepartmentHead ? "pending_department_head" : "pending_site_head")) { const error = new Error("This request is not in your approval step."); error.status = 409; throw error; }
    await client.query(`UPDATE change_request_approvals SET decision = 'returned', decided_by = $2, decided_at = now(), comment = $3 WHERE change_request_id = $1 AND approval_step = $4`, [change.change_request_id, req.user.employee_no, req.body.comment.trim(), isDepartmentHead ? 1 : 2]);
    await client.query("UPDATE policy_change_requests SET status = 'returned_for_revision', updated_at = now() WHERE change_request_id = $1", [change.change_request_id]);
    await audit(client, { actor: req.user.employee_no, policyCode: change.policy_code, changeRequestId: change.change_request_id, action: "returned", comment: req.body.comment.trim() });
    return { status: "returned_for_revision" };
  });
  if (!result) return res.sendStatus(404);
  res.json(result);
});

app.get("/api/policies/:policyCode/audit-logs", requireRole("admin"), async (req, res) => {
  const code = parse(policyCode, req.params.policyCode);
  const { action } = req.query;
  const { rows } = await db.query(
    `SELECT l.*, u.display_name AS actor_name FROM policy_audit_logs l JOIN users u ON u.employee_no = l.actor_employee_no
      WHERE l.policy_code = $1 AND ($2::audit_action IS NULL OR l.action = $2::audit_action)
      ORDER BY l.occurred_at DESC`, [code, action || null],
  );
  res.json(rows);
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({ error: error.message || "Internal server error.", details: error.details });
});

app.listen(port, () => {
  console.log(`Policy API listening on http://localhost:${port}`);
  startScheduledPublisher();
});
