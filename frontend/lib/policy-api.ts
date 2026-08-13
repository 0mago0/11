/**
 * Express API 的唯一前端入口。
 *
 * VITE_POLICY_API_URL 未設定時使用本機 Express 預設位置。所有請求都帶員編，
 * 讓開發環境可使用資料庫內的角色資料驗證權限。
 */
const apiUrl = (import.meta.env.VITE_POLICY_API_URL || "http://localhost:3001").replace(/\/$/, "");

export type SignedInUser = {
  employeeNo: string;
  name: string;
  role: "admin" | "employee" | "department_head" | "site_head";
  roles: string[];
};

export type ApiTranslation = {
  language: "zh-TW" | "ja-JP";
  title: string;
  summary: string;
  content: string;
  chapters: unknown[];
  tables: unknown[];
};

export type ApiWorkspacePolicy = {
  policy_code: string;
  category_zh: string;
  category_ja: string;
  status: string;
  effective_date: string | null;
  scheduled_publish_date?: string | null;
  versions: Array<{ versionNo: number; publishedAt: string; revisionNote?: string; revisionDate?: string | null; revisionContent?: string; translations: ApiTranslation[] }>;
  activeChange: null | {
    changeRequestId: string;
    status: string;
    changeKind: "new_policy" | "typo" | "content";
    revisionReason: string;
    revisionDate?: string | null;
    revisionContent?: string;
    scheduledPublishDate?: string | null;
    submittedAt?: string | null;
    approvedAt?: string | null;
    translations: ApiTranslation[];
  };
};

const request = async <T>(path: string, employeeNo: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", "X-Employee-No": employeeNo, ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `API request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
};

/** 登入入口；未來公司 API／SSO 串接時仍維持這個前端契約。 */
export const signIn = async (account: string, password: string) => {
  const response = await fetch(`${apiUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ account, password }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "登入失敗，請重新確認帳號與密碼。");
  }
  return response.json() as Promise<SignedInUser>;
};

/** 先讀清單再讀詳情，讓畫面取得各版本的中日文內容與目前草稿。 */
export async function loadPolicyWorkspace(employeeNo: string): Promise<ApiWorkspacePolicy[]> {
  const list = await request<Array<{ policy_code: string }>>("/api/policies", employeeNo);
  return Promise.all(list.map(({ policy_code }) => request<ApiWorkspacePolicy>(`/api/policies/${encodeURIComponent(policy_code)}`, employeeNo)));
}

export const saveNewPolicy = (employeeNo: string, body: {
  policyCode: string; categoryCode: string; effectiveDate?: string; revisionReason: string; revisionDate?: string; revisionContent?: string; translations: ApiTranslation[];
}) => request<{ change_request_id: string }>("/api/policies", employeeNo, { method: "POST", body: JSON.stringify(body) });

export const savePolicyChange = (employeeNo: string, policyCode: string, body: {
  changeKind: "typo" | "content"; revisionReason: string; revisionDate?: string; revisionContent?: string; requestedEffectiveDate?: string; scheduledPublishDate?: string; translations: ApiTranslation[];
}) => request<{ change_request_id: string }>(`/api/policies/${encodeURIComponent(policyCode)}/changes`, employeeNo, { method: "POST", body: JSON.stringify(body) });

export const updatePolicyChange = (employeeNo: string, changeRequestId: string, body: {
  changeKind: "typo" | "content"; revisionReason: string; revisionDate?: string; revisionContent?: string; requestedEffectiveDate?: string; scheduledPublishDate?: string; translations: ApiTranslation[];
}) => request(`/api/change-requests/${encodeURIComponent(changeRequestId)}`, employeeNo, { method: "PATCH", body: JSON.stringify(body) });

export const submitChange = (employeeNo: string, changeRequestId: string) =>
  request(`/api/change-requests/${encodeURIComponent(changeRequestId)}/submit`, employeeNo, { method: "POST" });

export const publishTypoChange = (employeeNo: string, changeRequestId: string) =>
  request(`/api/change-requests/${encodeURIComponent(changeRequestId)}/publish`, employeeNo, { method: "POST" });

/** 停用會寫入 PostgreSQL，並產生不可竄改的停用稽核紀錄。 */
export const disablePolicy = (employeeNo: string, policyCode: string) =>
  request<{ status: "disabled"; alreadyDisabled: boolean }>(
    `/api/policies/${encodeURIComponent(policyCode)}/disable`,
    employeeNo,
    { method: "POST" },
  );

export const approveChange = (employeeNo: string, changeRequestId: string, comment = "") =>
  request(`/api/change-requests/${encodeURIComponent(changeRequestId)}/approve`, employeeNo, { method: "POST", body: JSON.stringify({ comment }) });

export const returnChange = (employeeNo: string, changeRequestId: string, comment: string) =>
  request(`/api/change-requests/${encodeURIComponent(changeRequestId)}/return`, employeeNo, { method: "POST", body: JSON.stringify({ comment }) });

export type ApiAuditLog = {
  audit_id: string;
  occurred_at: string;
  actor_name?: string | null;
  actor_employee_no: string;
  policy_code: string;
  action: string;
  from_version_no?: number | null;
  to_version_no?: number | null;
  changed_fields?: string[] | null;
  before_content?: unknown;
  after_content?: unknown;
  comment?: string | null;
};

/** Admin 修改紀錄頁的正式資料來源。 */
export const loadPolicyAuditLogs = (employeeNo: string, policyCode: string) =>
  request<ApiAuditLog[]>(
    `/api/policies/${encodeURIComponent(policyCode)}/audit-logs`,
    employeeNo,
  );

/** Admin 或排程服務可呼叫此端點，發布所有已到期的承認案件。 */
export const publishScheduledChanges = (employeeNo: string) =>
  request<{ published: Array<{ policyCode: string; versionNo: number }> }>("/api/system/publish-scheduled", employeeNo, { method: "POST" });

export const apiConfig = { apiUrl };
