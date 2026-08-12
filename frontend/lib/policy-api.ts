/**
 * Express API 的唯一前端入口。
 *
 * VITE_POLICY_API_URL 未設定時使用本機 Express 預設位置。所有請求都帶員編，
 * 讓開發環境可使用資料庫內的角色資料驗證權限。
 */
const apiUrl = (import.meta.env.VITE_POLICY_API_URL || "http://localhost:3001").replace(/\/$/, "");

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
  versions: Array<{ versionNo: number; publishedAt: string; revisionNote?: string; translations: ApiTranslation[] }>;
  activeChange: null | {
    changeRequestId: string;
    status: string;
    changeKind: "new_policy" | "typo" | "content";
    revisionReason: string;
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

/** 先讀清單再讀詳情，讓畫面取得各版本的中日文內容與目前草稿。 */
export async function loadPolicyWorkspace(employeeNo: string): Promise<ApiWorkspacePolicy[]> {
  const list = await request<Array<{ policy_code: string }>>("/api/policies", employeeNo);
  return Promise.all(list.map(({ policy_code }) => request<ApiWorkspacePolicy>(`/api/policies/${encodeURIComponent(policy_code)}`, employeeNo)));
}

export const apiConfig = { apiUrl };
