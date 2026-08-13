export type Lang = "zh" | "ja";
export type Role = "admin" | "employee" | "department_head" | "site_head";
export type Status = "草稿" | "發布" | "停用" | "停用待更新" | "已承認";
export type ChangeType = "typo" | "content";
export type ApprovalStage =
  | "草稿"
  | "待部門長承認"
  | "待據點長承認"
  | "退回修改"
  | "已承認待發布";
export type PolicyFilter =
  | "全部"
  | Status
  | "規程內容更新版本"
  | Exclude<ApprovalStage, "草稿">;

export type Approval = {
  stage: ApprovalStage;
  submittedAt?: string;
  approvedAt?: string;
  returnedAt?: string;
  returnedBy?: string;
  returnReason?: string;
};
/** tableRef 是條文關聯的表格序號（從 1 開始）；未設定時不顯示表格註解。 */
export type Article = { id: string; title: string; text: string; tableRef?: number };
export type Chapter = { id: string; title: string; articles: Article[] };
export type TableMerge = { startRow: number; startCol: number; endRow: number; endCol: number };
export type PolicyTable = { cells: string[][]; merges?: TableMerge[] };
export type Copy = {
  title: string;
  summary: string;
  content: string;
  tables: PolicyTable[];
  chapters: Chapter[];
};
export type Version = {
  id: string;
  number: string;
  publishedAt: string;
  copy: Record<Lang, Copy>;
  revisionNote?: string;
};
export type Policy = {
  id: number;
  code: string;
  category: string;
  effectiveDate: string;
  publishDate?: string;
  status: Status;
  draft: Record<Lang, Copy>;
  versions: Version[];
  attachments?: string[];
  relatedPolicies?: string[];
  revisionNote?: string;
  changeType?: ChangeType;
  approval?: Approval;
  replacesPolicyId?: number;
};
export type Audit = {
  id: string;
  at: string;
  actor: string;
  action:
    | "新增"
    | "修改草稿"
    | "送審"
    | "部門長承認"
    | "據點長承認"
    | "退回修改"
    | "發布"
    | "停用"
    | "還原";
  policy: string;
  code: string;
  before: string;
  after: string;
  fromVersion?: string;
  toVersion?: string;
  changes?: string[];
  comment?: string;
};
