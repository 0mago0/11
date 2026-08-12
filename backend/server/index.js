import "dotenv/config";
import express from "express";
import { db, withTransaction } from "./db.js";
import { authenticate, isAdmin, requireRole } from "./auth.js";
import { changeDraft, policyCode, policyCreate } from "./validation.js";

const app = express();
const port = Number(process.env.PORT || 3001);
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";

app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", corsOrigin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Employee-No");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
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

// 規程版本與修改申請都採相同的中日文翻譯資料結構，因此共用寫入邏輯。
const insertTranslations = async (client, table, ownerColumn, ownerId, translations) => {
  for (const item of translations) {
    await client.query(
      `INSERT INTO ${table} (${ownerColumn}, language, title, summary, content, chapters, tables)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)`,
      [ownerId, item.language, item.title, item.summary, item.content, JSON.stringify(item.chapters), JSON.stringify(item.tables)],
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
    `SELECT language, title, summary, content, chapters, tables
       FROM policy_change_translations WHERE change_request_id = $1`,
    [change.change_request_id],
  );
  if (!translations.length) {
    const error = new Error("A change request needs at least one translation before publishing.");
    error.status = 409;
    throw error;
  }
  await client.query(
    `INSERT INTO policy_versions (policy_code, version_no, effective_date, published_by, revision_note, source_change_request_id)
     VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4, $5, $6)`,
    [change.policy_code, versionNo, change.requested_effective_date, actorEmployeeNo, change.revision_reason, change.change_request_id],
  );
  for (const item of translations) {
    await client.query(
      `INSERT INTO policy_version_translations (policy_code, version_no, language, title, summary, content, chapters, tables)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)`,
      [change.policy_code, versionNo, item.language, item.title, item.summary, item.content, JSON.stringify(item.chapters), JSON.stringify(item.tables)],
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

app.get("/health", async (_req, res) => {
  await db.query("SELECT 1");
  res.json({ status: "ok" });
});

app.use("/api", authenticate);

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
    `SELECT version_no, published_at, revision_note FROM policy_versions
      WHERE policy_code = $1 ORDER BY version_no`, [code],
  );
  const { rows: versionTranslations } = await db.query(
    `SELECT version_no, language, title, summary, content, chapters, tables
       FROM policy_version_translations WHERE policy_code = $1`, [code],
  );
  const { rows: changes } = await db.query(
    `SELECT change_request_id, status, change_kind, revision_reason, scheduled_publish_date, submitted_at, approved_at
       FROM policy_change_requests WHERE policy_code = $1
        AND status NOT IN ('published', 'cancelled')
      ORDER BY updated_at DESC LIMIT 1`, [code],
  );
  const activeChange = changes[0] || null;
  const { rows: changeTranslations } = activeChange
    ? await db.query(
        `SELECT language, title, summary, content, chapters, tables
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
      translations: versionTranslations.filter((translation) => translation.version_no === version.version_no),
    })),
    activeChange: activeChange && {
      changeRequestId: activeChange.change_request_id,
      status: activeChange.status,
      changeKind: activeChange.change_kind,
      revisionReason: activeChange.revision_reason,
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
      `INSERT INTO policy_change_requests (policy_code, change_kind, revision_reason, requested_effective_date, requires_approval, created_by)
       VALUES ($1, 'new_policy', $2, $3, true, $4) RETURNING change_request_id`,
      [input.policyCode, input.revisionReason, input.effectiveDate || null, req.user.employee_no],
    );
    await insertTranslations(client, "policy_change_translations", "change_request_id", rows[0].change_request_id, input.translations);
    await audit(client, { actor: req.user.employee_no, policyCode: input.policyCode, changeRequestId: rows[0].change_request_id, action: "created", changedFields: ["policy", "translations"] });
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
      `INSERT INTO policy_change_requests (policy_code, base_version_no, change_kind, revision_reason, requested_effective_date, scheduled_publish_date, requires_approval, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING change_request_id, status`,
      [code, policies[0].current_version_no, input.changeKind, input.revisionReason, input.requestedEffectiveDate || null, input.scheduledPublishDate || null, requiresApproval, req.user.employee_no],
    );
    await insertTranslations(client, "policy_change_translations", "change_request_id", rows[0].change_request_id, input.translations);
    await audit(client, { actor: req.user.employee_no, policyCode: code, changeRequestId: rows[0].change_request_id, action: "draft_saved", fromVersionNo: policies[0].current_version_no, changedFields: ["translations", "revision_reason"] });
    return rows[0];
  });
  res.status(201).json(result);
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
  const published = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM policy_change_requests
        WHERE status = 'approved_scheduled' AND scheduled_publish_date <= CURRENT_DATE
        FOR UPDATE`,
    );
    const results = [];
    for (const change of rows) results.push(await publishChangeRequest(client, change, req.user.employee_no));
    return results;
  });
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

app.listen(port, () => console.log(`Policy API listening on http://localhost:${port}`));
