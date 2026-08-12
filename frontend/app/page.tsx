"use client";
import { FormEvent, MouseEvent, useEffect, useMemo, useState } from "react";
import { ApprovalPage } from "../components/pages/ApprovalPage";
import { AuditPage } from "../components/pages/AuditPage";
import { PolicyLibraryPage } from "../components/pages/PolicyLibraryPage";
import { StructureEditor } from "../components/policy/StructureEditor";
import { Tables } from "../components/policy/Tables";
import {
  approveChange, loadPolicyWorkspace, publishScheduledChanges, publishTypoChange,
  returnChange, saveNewPolicy, savePolicyChange, submitChange, updatePolicyChange,
  type ApiTranslation, type ApiWorkspacePolicy,
} from "../lib/policy-api";

type Lang = "zh" | "ja";
type Role = "admin" | "employee" | "department_head" | "site_head";
type Status = "草稿" | "發布" | "停用" | "停用待更新" | "已承認";
type ChangeType = "typo" | "content";
type ApprovalStage =
  | "草稿"
  | "待部門長承認"
  | "待據點長承認"
  | "退回修改"
  | "已承認待發布";
type PolicyFilter =
  | "全部"
  | Status
  | "規程內容更新版本"
  | Exclude<ApprovalStage, "草稿">;
type Approval = {
  stage: ApprovalStage;
  submittedAt?: string;
  approvedAt?: string;
  returnedAt?: string;
  returnedBy?: string;
  returnReason?: string;
};
type Article = { id: string; title: string; text: string };
type Chapter = { id: string; title: string; articles: Article[] };
type Copy = {
  title: string;
  summary: string;
  content: string;
  tables: string[][][];
  chapters: Chapter[];
};
type Version = {
  id: string;
  number: string;
  publishedAt: string;
  copy: Record<Lang, Copy>;
  revisionNote?: string;
};
type Policy = {
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
  /** Express API 的送審草稿 ID；本機示範資料不會有此欄位。 */
  changeRequestId?: string;
};

const policyCategories = [
  "全社基本",
  "人事",
  "IT管理",
  "總務",
  "營業管理",
  "會計管理",
  "EHS",
  "進出口管理",
  "COW",
  "ISO9001",
];
const categoryCodePrefixes: Record<string, string> = {
  全社基本: "DHT1",
  人事: "DHT2",
  IT管理: "DHT3",
  總務: "DHT3",
  營業管理: "DHT4",
  會計管理: "DHT5",
  EHS: "DHT6",
  進出口管理: "DHT7",
  COW: "DHT10",
  ISO9001: "DHT99",
};
const categoryCodePrefix = (category: string) =>
  categoryCodePrefixes[category] || categoryCodePrefixes["全社基本"];
const policyCode = (category: string, value: string, fallback = "0000") => {
  const digits = value.replace(/\D/g, "").slice(-4) || fallback;
  return `${categoryCodePrefix(category)}-${digits.padStart(4, "0")}`;
};
const policyCodeSuffix = (value: string) =>
  (value.replace(/\D/g, "").slice(-4) || "0000").padStart(4, "0");
// 編輯欄位不顯示自動補上的前導零，避免游標每輸入一碼就跳到末尾而無法連續輸入編號。
const editablePolicyCodeSuffix = (value: string) =>
  policyCodeSuffix(value).replace(/^0+(?=\d)/, "").replace(/^0+$/, "");
type Audit = {
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
const emptyCopy = (): Copy => ({
  title: "",
  summary: "",
  content: "",
  tables: [],
  chapters: [],
});
const chaptersFromContent = (content: string): Chapter[] => {
  const articles = content
    .split("\n")
    .filter(Boolean)
    .map((text, index) => {
      const match = text.match(
        /^(第[一二三四五六七八九十\d]+條|第\d+条)[　\s]*(.*)$/,
      );
      return {
        id: `article-${index + 1}`,
        title: match?.[1] || `第 ${index + 1} 條`,
        text: match?.[2] || text,
      };
    });
  return articles.length
    ? [{ id: "chapter-1", title: "第一章　總則", articles }]
    : [];
};
const copy = (
  title: string,
  summary: string,
  content: string,
  tables: string[][][] = [],
): Copy => ({
  title,
  summary,
  content,
  tables,
  chapters: chaptersFromContent(content),
});
const normalizeCopy = (value: Partial<Copy>): Copy => ({
  title: value.title || "",
  summary: value.summary || "",
  content: value.content || "",
  tables: normalizeTables(value.tables),
  chapters: value.chapters?.length
    ? value.chapters
    : chaptersFromContent(value.content || ""),
});
const needsDisabledUpdateStatus = (value: Policy) => {
  const latestVersion = value.versions?.at(-1);
  const hasEditedDraft =
    !!latestVersion &&
    JSON.stringify(value.draft) !== JSON.stringify(latestVersion.copy);
  const awaitingApproval = ["待部門長承認", "待據點長承認"].includes(
    value.approval?.stage || "",
  );
  return value.status === "停用" && (hasEditedDraft || awaitingApproval);
};
const normalizePolicy = (value: Policy): Policy => {
  const category = policyCategories.includes(value.category)
    ? value.category
    : "人事";
  return {
    ...value,
    category,
    code: policyCode(category, value.code, String(value.id)),
    status: needsDisabledUpdateStatus(value) ? "停用待更新" : value.status,
    attachments: value.attachments || [],
    relatedPolicies: value.relatedPolicies || [],
    revisionNote: value.revisionNote || "",
    publishDate: value.publishDate || "",
    changeType: value.changeType || "content",
    approval: value.approval || { stage: "草稿" },
    draft: {
      zh: normalizeCopy(value.draft.zh),
      ja: normalizeCopy(value.draft.ja),
    },
    versions: (value.versions || []).map((version) => ({
      ...version,
      copy: {
        zh: normalizeCopy(version.copy.zh),
        ja: normalizeCopy(version.copy.ja),
      },
    })),
  };
};
const splitLegacyUpdatePolicies = (values: Policy[]) => {
  let nextId = Math.max(0, ...values.map((policy) => policy.id)) + 1;
  return values.flatMap((policy) => {
    if (policy.status !== "停用待更新" || !policy.versions.length) {
      return [policy];
    }
    const published = {
      ...policy,
      status: "發布" as Status,
      draft: clone(policy.versions.at(-1)!.copy),
      approval: { stage: "草稿" as ApprovalStage },
      replacesPolicyId: undefined,
    };
    const update = {
      ...policy,
      id: nextId++,
      status: "草稿" as Status,
      replacesPolicyId: policy.id,
    };
    return [published, update];
  });
};
const ordinal = (number: number) =>
  ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"][number - 1] ||
  String(number);
const contentFromChapters = (chapters: Chapter[]) =>
  chapters
    .flatMap((chapter) =>
      chapter.articles.map((article) => `${article.title}　${article.text}`),
    )
    .join("\n\n");
const samplePolicy = (
  id: number,
  code: string,
  category: string,
  zhTitle: string,
  jaTitle: string,
  zhSummary: string,
  jaSummary: string,
  zhContent: string,
  jaContent: string,
): Policy => ({
  id,
  code: policyCode(category, code, String(id)),
  category,
  effectiveDate: "2025-04-01",
  publishDate: "2025-04-01",
  status: "發布",
  changeType: "content",
  approval: { stage: "草稿" },
  draft: {
    zh: copy(zhTitle, zhSummary, zhContent),
    ja: copy(jaTitle, jaSummary, jaContent),
  },
  versions: [
    {
      id: `sample-${id}`,
      number: "1.0",
      publishedAt: "2025-04-01",
      copy: {
        zh: copy(zhTitle, zhSummary, zhContent),
        ja: copy(jaTitle, jaSummary, jaContent),
      },
      revisionNote: "示範規程首次發布",
    },
  ],
});
const categoryDemoPolicies: Policy[] = [
  samplePolicy(
    101,
    "COR-001",
    "全社基本",
    "文件與規程管理辦法",
    "文書・規程管理規程",
    "規範全公司文件的制定、審核、發布與保存方式。",
    "全社文書の制定、承認、公開および保管方法を定めます。",
    "第一條　公司規程應依權責完成審核後始得發布。\n\n第二條　各單位應使用最新發布版本辦理作業。",
    "第1条　会社規程は、権限に基づく承認後に公開する。\n\n第2条　各部門は最新の公開版を使用して業務を行う。",
  ),
  samplePolicy(
    102,
    "IT-001",
    "IT管理",
    "資訊安全與帳號管理規程",
    "情報セキュリティ・アカウント管理規程",
    "規範資訊系統帳號申請、權限管理及資安事件通報。",
    "情報システムのアカウント申請、権限管理および事故報告を定めます。",
    "第一條　系統帳號應依職務需求申請，禁止共用帳號。\n\n第二條　發現資安事件時應立即通報資訊單位。",
    "第1条　システムアカウントは職務上の必要により申請し、共有してはならない。\n\n第2条　セキュリティ事故を発見した場合は直ちに情報部門へ連絡する。",
  ),
  samplePolicy(
    103,
    "GA-001",
    "總務",
    "辦公環境與資產管理規程",
    "オフィス環境・資産管理規程",
    "規範辦公設備、門禁、訪客及公司資產的管理原則。",
    "事務所設備、入退室、来訪者および会社資産の管理原則を定めます。",
    "第一條　公司資產應登錄管理並由使用人妥善保管。\n\n第二條　訪客進入辦公區前應完成登記。",
    "第1条　会社資産は台帳に登録し、使用者が適切に管理する。\n\n第2条　来訪者はオフィスエリアへの入室前に受付登録を行う。",
  ),
  samplePolicy(
    104,
    "SAL-001",
    "營業管理",
    "客戶報價與訂單管理規程",
    "見積・受注管理規程",
    "規範客戶報價、訂單確認及銷售資訊登錄流程。",
    "顧客見積、受注確認および販売情報登録の手順を定めます。",
    "第一條　對外報價應使用核准的價格與條件。\n\n第二條　訂單確認後應於系統完成登錄。",
    "第1条　対外見積は承認済みの価格および条件を使用する。\n\n第2条　受注確定後はシステムへ登録する。",
  ),
  samplePolicy(
    105,
    "ACC-001",
    "會計管理",
    "費用報支與付款管理規程",
    "経費精算・支払管理規程",
    "規範費用申請、憑證保存、核准與付款作業。",
    "経費申請、証憑保管、承認および支払業務を定めます。",
    "第一條　費用報支應檢附合法憑證並依核准權限辦理。\n\n第二條　付款資料應經覆核後執行。",
    "第1条　経費精算には適法な証憑を添付し、承認権限に従う。\n\n第2条　支払情報は照合後に実行する。",
  ),
  samplePolicy(
    106,
    "EHS-001",
    "EHS",
    "環境安全衛生管理規程",
    "環境・安全衛生管理規程",
    "規範職場安全、健康管理與緊急事故應變要求。",
    "職場安全、健康管理および緊急時対応の要求事項を定めます。",
    "第一條　員工應遵守職場安全規範並使用必要防護具。\n\n第二條　事故或異常狀況應立即通報。",
    "第1条　従業員は安全規則を守り、必要な保護具を使用する。\n\n第2条　事故または異常を直ちに報告する。",
  ),
  samplePolicy(
    107,
    "IMP-001",
    "進出口管理",
    "進出口文件與合規管理規程",
    "輸出入書類・コンプライアンス管理規程",
    "規範進出口申報文件、貨品分類及法規遵循。",
    "輸出入申告書類、品目分類および法令遵守を定めます。",
    "第一條　進出口申報資料應正確、完整並依規定保存。\n\n第二條　受管制貨品應於出貨前完成確認。",
    "第1条　輸出入申告資料は正確かつ完全に作成し、規定に従い保管する。\n\n第2条　規制対象品は出荷前に確認を完了する。",
  ),
  samplePolicy(
    108,
    "COW-001",
    "COW",
    "COW 協作作業管理規程",
    "COW 協働作業管理規程",
    "規範跨部門協作任務的指派、追蹤與結案方式。",
    "部門横断の協働タスクにおける割当、進捗管理および完了方法を定めます。",
    "第一條　跨部門任務應明確指定負責人與完成期限。\n\n第二條　任務進度應定期更新並保留紀錄。",
    "第1条　部門横断タスクには責任者と期限を明確に設定する。\n\n第2条　進捗は定期的に更新し、記録を残す。",
  ),
  samplePolicy(
    109,
    "ISO-001",
    "ISO9001",
    "ISO 9001 品質管理規程",
    "ISO 9001 品質マネジメント規程",
    "規範品質目標、內部稽核、不符合事項與持續改善流程。",
    "品質目標、内部監査、不適合事項および継続的改善の手順を定めます。",
    "第一條　各單位應依品質目標執行並定期檢討成效。\n\n第二條　發現不符合事項時應採取矯正措施。",
    "第1条　各部門は品質目標に従って実行し、定期的に有効性を確認する。\n\n第2条　不適合を発見した場合は是正措置を実施する。",
  ),
];
const approvalSamplePolicy = (
  id: number,
  code: string,
  category: string,
  stage: ApprovalStage,
  zhTitle: string,
  jaTitle: string,
  originalZh: string,
  revisedZh: string,
  originalJa: string,
  revisedJa: string,
  revisionNote: string,
): Policy => ({
  id,
  code: policyCode(category, code, String(id)),
  category,
  effectiveDate: "2026-10-01",
  publishDate: "2026-10-01",
  status: "草稿",
  changeType: "content",
  revisionNote,
  approval: { stage, submittedAt: "2026/08/12 下午 2:30:00" },
  draft: {
    zh: copy(zhTitle, "此為承認流程示範案件，請確認修訂內容。", revisedZh),
    ja: copy(
      jaTitle,
      "承認フローのサンプル案件です。改訂内容をご確認ください。",
      revisedJa,
    ),
  },
  versions: [
    {
      id: `approval-${id}`,
      number: "1.0",
      publishedAt: "2026-04-01",
      copy: {
        zh: copy(zhTitle, "此為原已發布版本。", originalZh),
        ja: copy(jaTitle, "前回公開版です。", originalJa),
      },
      revisionNote: "首次發布",
    },
  ],
});
const approvalDemoPolicies: Policy[] = [
  approvalSamplePolicy(
    201,
    "DHT3-0002",
    "IT管理",
    "待部門長承認",
    "資訊安全與帳號管理規程",
    "情報セキュリティ・アカウント管理規程",
    "第一條　系統帳號應依職務需求申請，禁止共用帳號。\n\n第二條　發現資安事件時應立即通報資訊單位。",
    "第一條　系統帳號應依職務需求申請，禁止共用帳號。\n\n第二條　發現資安事件時應於一小時內通報資訊單位。\n\n第三條　離職人員帳號應於最後工作日完成停用。",
    "第1条　システムアカウントは職務上の必要により申請し、共有してはならない。\n\n第2条　セキュリティ事故を発見した場合は直ちに情報部門へ連絡する。",
    "第1条　システムアカウントは職務上の必要により申請し、共有してはならない。\n\n第2条　セキュリティ事故は1時間以内に情報部門へ連絡する。\n\n第3条　退職者のアカウントは最終勤務日までに停止する。",
    "資安通報時限與離職帳號停用流程更新。",
  ),
  approvalSamplePolicy(
    202,
    "DHT6-0002",
    "EHS",
    "待部門長承認",
    "環境安全衛生管理規程",
    "環境・安全衛生管理規程",
    "第一條　員工應遵守職場安全規範並使用必要防護具。\n\n第二條　事故或異常狀況應立即通報。",
    "第一條　員工應遵守職場安全規範並使用必要防護具。\n\n第二條　事故或異常狀況應立即通報。\n\n第三條　高風險作業前應完成安全確認表。",
    "第1条　従業員は安全規則を守り、必要な保護具を使用する。\n\n第2条　事故または異常を直ちに報告する。",
    "第1条　従業員は安全規則を守り、必要な保護具を使用する。\n\n第2条　事故または異常を直ちに報告する。\n\n第3条　高リスク作業前に安全確認表を完了する。",
    "高風險作業的事前安全確認要求新增。",
  ),
  approvalSamplePolicy(
    203,
    "DHT5-0002",
    "會計管理",
    "待據點長承認",
    "費用報支與付款管理規程",
    "経費精算・支払管理規程",
    "第一條　費用報支應檢附合法憑證並依核准權限辦理。\n\n第二條　付款資料應經覆核後執行。",
    "第一條　費用報支應檢附合法憑證並依核准權限辦理。\n\n第二條　付款資料應經覆核後執行。\n\n第三條　超過十萬元之付款應由財務主管再次確認。",
    "第1条　経費精算には適法な証憑を添付し、承認権限に従う。\n\n第2条　支払情報は照合後に実行する。",
    "第1条　経費精算には適法な証憑を添付し、承認権限に従う。\n\n第2条　支払情報は照合後に実行する。\n\n第3条　10万元を超える支払は財務責任者が再確認する。",
    "高額付款的複核權限調整。",
  ),
];
const demoPolicies = [...categoryDemoPolicies, ...approvalDemoPolicies];
const initial: Policy[] = [
  {
    id: 1,
    code: "DHT2-0001",
    category: "人事",
    effectiveDate: "2025-01-01",
    status: "發布",
    changeType: "content",
    draft: {
      zh: copy(
        "員工聘僱與任用規程",
        "規範招募、任用、試用及正式聘僱的作業原則。",
        "第一條　為建立公平、透明之任用制度，特訂定本規程。\n\n第二條　各職缺應依核准編制及職務說明書辦理招募。",
        [
          ["項目", "說明", "負責單位"],
          ["招募", "依職務說明書辦理", "人力資源部"],
        ],
      ),
      ja: copy(
        "雇用・任用規程",
        "採用、任用、試用及び正式雇用に関する基本原則を定めます。",
        "第1条　公正で透明な任用制度を確立するため、本規程を定める。\n\n第2条　各求人は承認された人員計画および職務記述書に基づき採用する。",
        [
          ["項目", "内容", "担当部署"],
          ["採用", "職務記述書に基づき実施", "人事部"],
        ],
      ),
    },
    versions: [
      {
        id: "1",
        number: "3.2",
        publishedAt: "2025-01-06",
        copy: {
          zh: copy(
            "員工聘僱與任用規程",
            "規範招募、任用、試用及正式聘僱的作業原則。",
            "第一條　為建立公平、透明之任用制度，特訂定本規程。\n\n第二條　各職缺應依核准編制及職務說明書辦理招募。",
            [
              ["項目", "說明", "負責單位"],
              ["招募", "依職務說明書辦理", "人力資源部"],
            ],
          ),
          ja: copy(
            "雇用・任用規程",
            "採用、任用、試用及び正式雇用に関する基本原則を定めます。",
            "第1条　公正で透明な任用制度を確立するため、本規程を定める。\n\n第2条　各求人は承認された人員計画および職務記述書に基づき採用する。",
            [
              ["項目", "内容", "担当部署"],
              ["採用", "職務記述書に基づき実施", "人事部"],
            ],
          ),
        },
      },
    ],
  },
  {
    id: 2,
    code: "DHT2-0002",
    category: "人事",
    effectiveDate: "2024-07-01",
    status: "發布",
    changeType: "content",
    draft: {
      zh: copy(
        "出勤與請假管理規程",
        "說明工作時間、打卡、加班、各類假別及申請程序。",
        "第一條　員工應依公司規定時間出勤並完成打卡。\n\n第二條　請假應於系統提出申請。",
      ),
      ja: copy(
        "勤怠・休暇管理規程",
        "勤務時間、勤怠記録、残業、休暇および申請手続を定めます。",
        "第1条　従業員は会社の定める時間に出勤し、勤怠記録を行う。\n\n第2条　休暇はシステムで申請する。",
      ),
    },
    versions: [
      {
        id: "2",
        number: "2.8",
        publishedAt: "2024-06-18",
        copy: {
          zh: copy(
            "出勤與請假管理規程",
            "說明工作時間、打卡、加班、各類假別及申請程序。",
            "第一條　員工應依公司規定時間出勤並完成打卡。\n\n第二條　請假應於系統提出申請。",
          ),
          ja: copy(
            "勤怠・休暇管理規程",
            "勤務時間、勤怠記録、残業、休暇および申請手続を定めます。",
            "第1条　従業員は会社の定める時間に出勤し、勤怠記録を行う。\n\n第2条　休暇はシステムで申請する。",
          ),
        },
      },
    ],
  },
  ...demoPolicies,
];
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const nextV = (v: string) => {
  const [a, b] = v.split(".").map(Number);
  return `${a}.${b + 1}`;
};
const now = () => new Date().toLocaleString("zh-TW");
const normalizeTables = (value: unknown): string[][][] => {
  if (!Array.isArray(value) || value.length === 0) return [];
  if (Array.isArray(value[0]) && typeof value[0][0] === "string")
    return [
      (value as string[][]).map((row) =>
        Array.isArray(row) ? row.map((cell) => String(cell)) : [],
      ),
    ];
  return value
    .filter(Array.isArray)
    .map((table) =>
      (table as unknown[])
        .filter(Array.isArray)
        .map((row) => (row as unknown[]).map((cell) => String(cell))),
    );
};

// 將 PostgreSQL API 的 snake_case 回應轉為現有畫面使用的 Policy 型別。
// 保留此轉換層，可避免資料庫欄位改名時直接影響 UI 元件。
const copyFromApi = (translations: ApiTranslation[]): Record<Lang, Copy> => {
  const find = (language: ApiTranslation["language"]) => translations.find((item) => item.language === language);
  const toCopy = (item?: ApiTranslation): Copy => ({
    title: item?.title || "", summary: item?.summary || "", content: item?.content || "",
    tables: normalizeTables(item?.tables), chapters: Array.isArray(item?.chapters) ? item!.chapters as Chapter[] : chaptersFromContent(item?.content || ""),
  });
  return { zh: toCopy(find("zh-TW")), ja: toCopy(find("ja-JP")) };
};
const policyFromApi = (source: ApiWorkspacePolicy, index: number): Policy => {
  const active = source.activeChange;
  const stageMap: Record<string, ApprovalStage> = {
    draft: "草稿", pending_department_head: "待部門長承認", pending_site_head: "待據點長承認",
    returned_for_revision: "退回修改", approved_scheduled: "已承認待發布",
  };
  const statusMap: Record<string, Status> = { published: "發布", disabled: "停用", draft: "草稿", approved_scheduled: "已承認" };
  const versions: Version[] = source.versions.map((version) => ({
    id: `${source.policy_code}-${version.versionNo}`, number: String(version.versionNo),
    publishedAt: String(version.publishedAt).slice(0, 10), copy: copyFromApi(version.translations), revisionNote: version.revisionNote || "",
  }));
  return {
    id: index + 1, code: source.policy_code, category: source.category_zh || source.category_ja || "人事",
    effectiveDate: source.effective_date ? String(source.effective_date).slice(0, 10) : "",
    publishDate: active?.scheduledPublishDate ? String(active.scheduledPublishDate).slice(0, 10) : "",
    status: active?.status === "approved_scheduled" ? "已承認" : statusMap[source.status] || "草稿",
    changeType: active?.changeKind === "typo" ? "typo" : "content",
    revisionNote: active?.revisionReason || versions.at(-1)?.revisionNote || "",
    approval: { stage: stageMap[active?.status || ""] || "草稿", submittedAt: active?.submittedAt || undefined, approvedAt: active?.approvedAt || undefined },
    draft: active ? copyFromApi(active.translations) : (versions.at(-1)?.copy || { zh: emptyCopy(), ja: emptyCopy() }),
    versions, changeRequestId: active?.changeRequestId,
  };
};

const categoryApiCodes: Record<string, string> = {
  全社基本: "basic", 人事: "hr", IT管理: "it", 總務: "general_affairs", 營業管理: "sales",
  會計管理: "accounting", EHS: "ehs", 進出口管理: "import_export", COW: "cow", ISO9001: "iso9001",
};
const apiTranslationsFromCopy = (draft: Record<Lang, Copy>): ApiTranslation[] => [
  { language: "zh-TW", ...draft.zh }, { language: "ja-JP", ...draft.ja },
].filter((item) => Boolean(item.title));
const apiEmployeeNoByRole: Record<Role, string> = {
  admin: "A0001", employee: "A0002", department_head: "A0003", site_head: "A0004",
};

export default function Home() {
  // 頁面狀態集中在此容器：子元件只接收資料與回呼，避免各頁有不同版本的流程判斷。
  const [policies, setPolicies] = useState(initial),
    [selectedId, setSelectedId] = useState(1),
    [lang, setLang] = useState<Lang>("zh"),
    [role, setRole] = useState<Role>("employee"),
    [name, setName] = useState("Employee"),
    [view, setView] = useState<"library" | "audit" | "approval">("library"),
    [editing, setEditing] = useState(false),
    [draft, setDraft] = useState<Policy>(clone(initial[0])),
    [search, setSearch] = useState(""),
    [auditSearch, setAuditSearch] = useState(""),
    [auditActionFilter, setAuditActionFilter] = useState<
      Audit["action"] | "全部"
    >("全部"),
    [category, setCategory] = useState("全部規程"),
    [statusFilter, setStatusFilter] = useState<PolicyFilter>("全部"),
    [sortMode, setSortMode] = useState<"status" | "updated">("status"),
    [notice, setNotice] = useState(""),
    [audit, setAudit] = useState<Audit[]>([]),
    [returnComments, setReturnComments] = useState<Record<number, string>>({}),
    [approvalSelectedId, setApprovalSelectedId] = useState<number | null>(null),
    [auditPolicyId, setAuditPolicyId] = useState<number | null>(null),
    [compare, setCompare] = useState<[number, number]>([0, 0]);
  useEffect(() => {
    // 舊版 localStorage 可能缺少後來加入的欄位，讀取後先正規化再放入畫面。
    try {
      const s = localStorage.getItem("hr-policy-v8");
      if (s) {
        const d = JSON.parse(s) as { policies: Policy[]; audit: Audit[] };
        const normalized = splitLegacyUpdatePolicies(
          d.policies.map(normalizePolicy),
        );
        const codeMap = Object.fromEntries(
          d.policies.map((policy, index) => [
            policy.code,
            normalized[index]?.code || policy.code,
          ]),
        );
        const normalizedAudit = (d.audit || []).map((entry) => ({
          ...entry,
          code: codeMap[entry.code] || entry.code,
        }));
        const existingCodes = new Set(normalized.map((policy) => policy.code));
        const hydrated = [
          ...normalized,
          ...demoPolicies.filter((policy) => !existingCodes.has(policy.code)),
        ];
        setPolicies(hydrated);
        setAudit(normalizedAudit);
        setSelectedId(hydrated[0]?.id || 1);
        setDraft(clone(hydrated[0] || initial[0]));
        localStorage.setItem(
          "hr-policy-v8",
          JSON.stringify({ policies: hydrated, audit: normalizedAudit }),
        );
      }
      const preview = localStorage.getItem(
        "hr-policy-role-preview",
      ) as Role | null;
      if (
        ["admin", "employee", "department_head", "site_head"].includes(
          preview || "",
        )
      ) {
        setRole(preview as Role);
        setLang(
          preview === "department_head" || preview === "site_head"
            ? "ja"
            : "zh",
        );
        setName(
          preview === "admin"
            ? "Admin preview"
            : preview === "department_head"
              ? "部門長 preview"
              : preview === "site_head"
                ? "據點長 preview"
                : "Employee preview",
        );
        return;
      }
    } catch {}
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((x) => {
        if (x) {
          setRole(x.role);
          setLang(
            x.role === "department_head" || x.role === "site_head"
              ? "ja"
              : "zh",
          );
          setName(x.name);
        }
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    // 角色預覽對應資料庫中的四個示範員編。正式登入串接後可改為登入 token 內的員編。
    let cancelled = false;
    loadPolicyWorkspace(apiEmployeeNoByRole[role])
      .then((remotePolicies) => {
        if (cancelled) return;
        const hydrated = remotePolicies.map(policyFromApi);
        setPolicies(hydrated);
        setAudit([]);
        setSelectedId(hydrated[0]?.id || 0);
        setDraft(clone(hydrated[0] || initial[0]));
        setNotice("已從 PostgreSQL 載入規程資料。");
      })
      .catch(() => {
        // API 尚未啟動時仍保留 localStorage 示範資料，方便單獨開發前端。
      });
    return () => { cancelled = true; };
  }, [role]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const saveStore = (next: Policy[], nextAudit: Audit[] = audit) => {
    // 所有會改變規程的動作都經過這裡，確保畫面與瀏覽器暫存同步。
    setPolicies(next);
    setAudit(nextAudit);
    localStorage.setItem(
      "hr-policy-v8",
      JSON.stringify({ policies: next, audit: nextAudit }),
    );
  };
  const isAdmin = role === "admin";
  const isDepartmentHead = role === "department_head";
  const isSiteHead = role === "site_head";
  const isApprover = isDepartmentHead || isSiteHead;
  const ui = (zh: string, ja: string) => (isApprover ? ja : zh);
  const statusName = (status: string) =>
    isApprover
      ? {
          全部: "すべて",
          草稿: "下書き",
          待部門長承認: "部門長承認待ち",
          待據點長承認: "拠点長承認待ち",
          退回修改: "差戻し・修正待ち",
          已承認待發布: "承認済み・公開待ち",
          規程內容更新版本: "規程内容更新版",
          發布: "公開中",
          停用: "停止中",
        }[status] || status
      : status;
  const visiblePolicies =
    role === "employee"
      ? policies.filter((policy) => policy.status === "發布")
      : policies;
  const hasNoEmployeePolicies =
    role === "employee" && visiblePolicies.length === 0;
  const isNewPolicy =
    editing && !policies.some((policy) => policy.id === draft.id);
  const selected =
    (isNewPolicy ? draft : visiblePolicies.find((x) => x.id === selectedId)) ||
    visiblePolicies[0] ||
    draft;
  const versions = selected.versions;
  const releasedCopy = (policy: Policy) =>
    policy.versions.at(-1)?.copy || policy.draft;
  const policyCopy = (policy: Policy) =>
    policy.replacesPolicyId ? policy.draft : releasedCopy(policy);
  const hasSavedDraft = (policy: Policy) =>
    policy.versions.length > 0 &&
    JSON.stringify(policy.draft) !== JSON.stringify(releasedCopy(policy));
  const displayedCopy = policyCopy(selected);
  const selectedDisplayLang: Lang =
    isApprover &&
    !(
      displayedCopy.ja.title ||
      displayedCopy.ja.summary ||
      displayedCopy.ja.content
    )
      ? "zh"
      : lang;
  const isApprovalLocked = ["待部門長承認", "待據點長承認"].includes(
    selected.approval?.stage || "",
  );
  const canChooseChangeType =
    !selected.replacesPolicyId &&
    selected.status !== "停用" &&
    selected.approval?.stage !== "退回修改" &&
    (selected.versions.length > 0 ||
      selected.approval?.stage === "已承認待發布");
  const reviewLanguage = (policy: Policy): Lang =>
    policy.draft.ja.title || policy.draft.ja.summary || policy.draft.ja.content
      ? "ja"
      : "zh";
  const policyStatusLabel = (policy: Policy) => {
    if (role === "employee") return "發布";
    // 送審流程比資料庫的公開狀態更具體：新規程尚未公開時底層為 disabled，
    // 但在 Admin／承認者畫面必須清楚顯示目前卡在哪一個承認關卡。
    if (policy.approval?.stage && policy.approval.stage !== "草稿") {
      return policy.approval.stage;
    }
    if (policy.status === "停用待更新") return "停用";
    if (policy.changeType === "content" && policy.status === "停用")
      return "停用";
    return policy.status;
  };
  // 色彩同樣以畫面真正顯示的流程狀態判斷，不能再直接使用資料庫的 disabled 值。
  const policyStatusTone = (policy: Policy) => {
    const label = policyStatusLabel(policy);
    if (["草稿", "待部門長承認", "待據點長承認", "已承認待發布"].includes(label)) return "draft";
    if (["停用", "退回修改"].includes(label)) return "disabled";
    return "";
  };
  const matchesPolicyStatus = (policy: Policy, status: PolicyFilter) =>
    (status === "規程內容更新版本" && Boolean(policy.replacesPolicyId)) ||
    policyStatusLabel(policy) === status ||
    (Boolean(policy.replacesPolicyId) && policy.approval?.stage === status);
  const statusOptions: PolicyFilter[] = [
    "全部",
    "草稿",
    "待部門長承認",
    "待據點長承認",
    "退回修改",
    "已承認待發布",
    "規程內容更新版本",
    "發布",
    "停用",
  ];
  const visibleStatusOptions = isApprover
    ? (["全部", "發布", "已承認待發布"] as PolicyFilter[])
    : statusOptions;
  const statusCounts = Object.fromEntries(
    visibleStatusOptions.map((status) => [
      status,
      status === "全部"
        ? visiblePolicies.length
        : visiblePolicies.filter((policy) =>
            matchesPolicyStatus(policy, status),
          ).length,
    ]),
  ) as Record<PolicyFilter, number>;
  const changePreviewRole = (next: Role) => {
    // 僅供展示角色權限；正式登入時改由 /api/me 的使用者資料取代。
    localStorage.setItem("hr-policy-role-preview", next);
    setRole(next);
    setLang(next === "department_head" || next === "site_head" ? "ja" : "zh");
    setName(
      next === "admin"
        ? "Admin preview"
        : next === "department_head"
          ? "部門長 preview"
          : next === "site_head"
            ? "據點長 preview"
            : "Employee preview",
    );
    setView("library");
  };
  const categoryPages = ["全部規程", ...policyCategories];
  const statusOrder = [
    "待部門長承認",
    "待據點長承認",
    "退回修改",
    "已承認待發布",
    "規程內容更新版本",
    "草稿",
    "發布",
    "停用",
  ];
  const lastUpdateIndex = (policy: Policy) => {
    const index = audit.findIndex((entry) => entry.code === policy.code);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  const list = useMemo(
    () =>
      [...visiblePolicies]
        .filter(
          (p) =>
            (category === "全部規程" || p.category === category) &&
            (role === "employee" ||
              statusFilter === "全部" ||
              matchesPolicyStatus(p, statusFilter)) &&
            `${p.code} ${policyCopy(p).zh.title} ${policyCopy(p).zh.content} ${policyCopy(p).ja.title} ${policyCopy(p).ja.content} ${p.draft.zh.title} ${p.draft.zh.content} ${p.draft.ja.title} ${p.draft.ja.content}`
              .toLowerCase()
              .includes(search.toLowerCase()),
        )
        .sort((left, right) =>
          sortMode === "updated"
            ? lastUpdateIndex(left) - lastUpdateIndex(right)
            : statusOrder.indexOf(policyStatusLabel(left)) -
              statusOrder.indexOf(policyStatusLabel(right)),
        ),
    [visiblePolicies, category, search, role, statusFilter, sortMode, audit],
  );
  const changedFields = (before: string, after: string) => {
    if (before === after) return ["規程內容"];
    try {
      const oldValue = JSON.parse(before);
      const newValue = JSON.parse(after);
      const oldCopy = oldValue.zh || oldValue;
      const newCopy = newValue.zh || newValue;
      const fields: Array<[string, string]> = [
        ["規程名稱", "title"],
        ["摘要", "summary"],
        ["規程全文", "content"],
        ["表格", "tables"],
      ];
      const changed = fields
        .filter(
          ([, key]) =>
            JSON.stringify(oldCopy?.[key]) !== JSON.stringify(newCopy?.[key]),
        )
        .map(([label]) => label);
      return changed.length ? changed : ["規程內容"];
    } catch {
      return ["規程狀態"];
    }
  };
  const log = (
    action: Audit["action"],
    before: string,
    after: string,
    p: Policy,
  ) => {
    const latestVersion = p.versions.at(-1)?.number;
    const previousVersion = p.versions.at(-2)?.number;
    const versions =
      action === "發布"
        ? {
            fromVersion: previousVersion ? `v${previousVersion}` : "未發布",
            toVersion: latestVersion ? `v${latestVersion}` : "發布中",
          }
        : action === "停用"
          ? {
              fromVersion: latestVersion ? `v${latestVersion}` : "草稿",
              toVersion: "停用",
            }
          : action === "新增"
            ? { fromVersion: "未建立", toVersion: "草稿" }
            : {
                fromVersion: latestVersion ? `v${latestVersion}` : "未發布",
                toVersion: "草稿",
              };
    const item = {
      id: String(Date.now()),
      at: now(),
      actor: name,
      action,
      policy: p.draft.zh.title || p.draft.ja.title,
      code: p.code,
      before,
      after,
      changes: changedFields(before, after),
      ...versions,
    };
    return [item, ...audit];
  };
  const open = (p: Policy) => {
    // 使用深複製避免編輯草稿時直接修改清單中的已保存資料。
    setSelectedId(p.id);
    setDraft(clone(p));
    setEditing(false);
    setCompare([
      Math.max(0, p.versions.length - 2),
      Math.max(0, p.versions.length - 1),
    ]);
    if (p.approval?.stage === "已承認待發布" && p.changeType === "typo") {
      setNotice("錯字修正沿用既有承認，等待發布日公開");
    }
  };
  const update = (field: keyof Copy, value: Copy[keyof Copy]) =>
    setDraft((p) => ({
      ...p,
      draft: {
        ...p.draft,
        [lang]: {
          ...p.draft[lang],
          [field]: value,
          ...(field === "content"
            ? { chapters: chaptersFromContent(String(value)) }
            : {}),
        },
      },
    }));
  const updateChapters = (chapters: Chapter[]) =>
    setDraft((policy) => ({
      ...policy,
      draft: {
        ...policy.draft,
        [lang]: {
          ...policy.draft[lang],
          chapters,
          content: contentFromChapters(chapters),
        },
      },
    }));
  function saveDraft(e?: FormEvent) {
    // 已送審的規程鎖定內容，直到承認完成或被退回，避免審核版本在途中改變。
    e?.preventDefault();
    if (!isAdmin) return;
    if (
      ["待部門長承認", "待據點長承認"].includes(draft.approval?.stage || "")
    ) {
      setNotice("此規程已送交承認，請等待承認完成或退回後再修改。");
      return;
    }
    const exists = policies.some((p) => p.code === draft.code),
      createsContentUpdate =
        exists &&
        !draft.replacesPolicyId &&
        (draft.changeType === "content" ||
          draft.approval?.stage === "退回修改") &&
        draft.status === "發布" &&
        draft.versions.length > 0,
      keepsScheduledApproval =
        draft.approval?.stage === "已承認待發布" && draft.changeType === "typo",
      before = exists ? JSON.stringify(selected.draft) : "（新增規程）",
      savedDraft = createsContentUpdate
        ? {
            ...draft,
            id: Date.now(),
            status: "草稿" as Status,
            approval: { stage: "草稿" as ApprovalStage },
            changeType: "content" as ChangeType,
            replacesPolicyId: draft.id,
          }
        : exists && draft.status === "停用" && hasSavedDraft(draft)
          ? { ...draft, status: "停用待更新" as Status }
          : draft,
      next = exists
        ? createsContentUpdate
          ? [savedDraft, ...policies]
          : policies.map((p) => (p.id === savedDraft.id ? savedDraft : p))
        : [savedDraft, ...policies],
      nextAudit = log(
        exists ? "修改草稿" : "新增",
        before,
        JSON.stringify(savedDraft.draft),
        savedDraft,
      );
    saveStore(next, nextAudit);
    open(savedDraft);
    // 寫入 PostgreSQL 成功後重新讀取，確保畫面版本、草稿 ID 與其他使用者看到的資料一致。
    const apiBody = {
      changeKind: savedDraft.changeType === "typo" ? ("typo" as const) : ("content" as const),
      revisionReason: savedDraft.revisionNote || "",
      requestedEffectiveDate: savedDraft.effectiveDate || undefined,
      scheduledPublishDate: savedDraft.publishDate || undefined,
      translations: apiTranslationsFromCopy(savedDraft.draft),
    };
    void (async () => {
      try {
        if (!exists) {
          await saveNewPolicy(apiEmployeeNoByRole.admin, {
            policyCode: savedDraft.code, categoryCode: categoryApiCodes[savedDraft.category] || "hr",
            effectiveDate: savedDraft.effectiveDate || undefined, revisionReason: savedDraft.revisionNote || "",
            translations: apiBody.translations,
          });
        } else if (savedDraft.changeRequestId) {
          await updatePolicyChange(apiEmployeeNoByRole.admin, savedDraft.changeRequestId, apiBody);
        } else {
          await savePolicyChange(apiEmployeeNoByRole.admin, savedDraft.code, apiBody);
        }
        const remote = await loadPolicyWorkspace(apiEmployeeNoByRole.admin);
        const refreshed = remote.map(policyFromApi);
        setPolicies(refreshed);
        const current = refreshed.find((policy) => policy.code === savedDraft.code) || refreshed[0];
        if (current) open(current);
        setNotice("草稿已儲存至 PostgreSQL。");
      } catch (error) {
        setNotice(`資料庫儲存失敗：${error instanceof Error ? error.message : "請確認 API 是否啟動"}`);
      }
    })();
    setNotice(
      keepsScheduledApproval
        ? `錯字修正已儲存，維持已承認狀態，將於 ${draft.publishDate || "發布日"} 公開。`
        : createsContentUpdate
          ? "內容更新草稿已建立為獨立規程卡片；原發布版本會持續供員工查看。"
          : "草稿已儲存；尚未建立發布版本。",
    );
  }
  function switchStatusFilter(nextStatus: PolicyFilter) {
    setStatusFilter(nextStatus);
    const firstPolicy = visiblePolicies.find(
      (policy) =>
        (category === "全部規程" || policy.category === category) &&
        (nextStatus === "全部" || matchesPolicyStatus(policy, nextStatus)),
    );
    if (firstPolicy) {
      setSelectedId(firstPolicy.id);
      setDraft(clone(firstPolicy));
    }
  }
  function switchCategoryPage(nextCategory: string) {
    const firstPolicy = visiblePolicies.find(
      (policy) =>
        (nextCategory === "全部規程" || policy.category === nextCategory) &&
        (statusFilter === "全部" || matchesPolicyStatus(policy, statusFilter)),
    );
    setCategory(nextCategory);
    if (firstPolicy) open(firstPolicy);
  }
  function guardEditingNavigation(event: MouseEvent<HTMLElement>) {
    if (!editing) return;
    const target = event.target as HTMLElement;
    if (target.closest("form")) return;
    if (window.confirm("目前有尚未儲存的編輯內容，是否先儲存草稿？")) {
      saveDraft();
    } else {
      setEditing(false);
      setDraft(clone(selected));
    }
  }
  function publishTypoFix() {
    // 錯字修正只允許已發布、非退回、非獨立內容更新卡的規程直接建立新版。
    if (!isAdmin) return;
    if (
      draft.changeType !== "typo" ||
      draft.status !== "發布" ||
      !draft.versions.length ||
      draft.replacesPolicyId ||
      draft.approval?.stage === "退回修改"
    ) {
      setNotice("只有已發布規程的純錯字修改可以直接發布。");
      return;
    }
    if (!draft.draft.zh.title && !draft.draft.ja.title) {
      setNotice("請至少填寫一種語言的規程名稱。");
      return;
    }
    // 若尚未儲存，先建立錯字草稿；有草稿 ID 時才可要求後端直接發布。
    const apiBody = {
      changeKind: "typo" as const,
      revisionReason: draft.revisionNote || "純錯字修正",
      requestedEffectiveDate: draft.effectiveDate || undefined,
      scheduledPublishDate: draft.publishDate || undefined,
      translations: apiTranslationsFromCopy(draft.draft),
    };
    void (async () => {
      try {
        const change = draft.changeRequestId
          ? { change_request_id: draft.changeRequestId }
          : await savePolicyChange(apiEmployeeNoByRole.admin, draft.code, apiBody);
        await publishTypoChange(apiEmployeeNoByRole.admin, change.change_request_id);
        await refreshWorkspace("admin", draft.code);
        setNotice("錯字修正已直接發布，PostgreSQL 已建立新版。 ");
      } catch (error) {
        setNotice(`錯字修正發布失敗：${error instanceof Error ? error.message : "請確認 API 是否啟動"}`);
      }
    })();
    const last = draft.versions.at(-1)?.number || "0.0";
    const version: Version = {
      id: String(Date.now()),
      number: nextV(last),
      publishedAt: new Date().toISOString().slice(0, 10),
      copy: clone(draft.draft),
      revisionNote: draft.revisionNote || "純錯字修正",
    };
    const next = {
      ...draft,
      status: "發布" as Status,
      versions: [...draft.versions, version],
      approval: { stage: "草稿" as ApprovalStage },
    };
    const all = policies.map((policy) =>
      policy.id === next.id ? next : policy,
    );
    saveStore(
      all,
      log(
        "發布",
        JSON.stringify(draft.versions.at(-1)?.copy || {}),
        JSON.stringify(version.copy),
        next,
      ),
    );
    open(next);
    setNotice(`錯字修正已直接發布，v${version.number} 已公開。`);
  }
  function submitForApproval() {
    // 內容更新會保留原發布卡給 Employee 閱讀，草稿則以獨立卡片走承認流程。
    if (!isAdmin) return;
    if (
      draft.approval?.stage === "已承認待發布" &&
      draft.changeType === "typo"
    ) {
      setNotice("錯字修正會沿用既有承認，等待發布日期即可公開。");
      return;
    }
    // 僅在後端成功切換為 pending_department_head 後才重載畫面；
    // 不能先把前端改成待承認，否則部門長會收到資料庫仍是草稿的假案件。
    setNotice("送交部門長承認處理中…");
    void resolveChangeRequestId(draft, "admin")
      .then((changeRequestId) => submitChange(apiEmployeeNoByRole.admin, changeRequestId))
      .then(async () => {
        await refreshWorkspace("admin", draft.code);
        setNotice("已送交部門長承認（PostgreSQL 已更新）。");
      })
      .catch((error) => setNotice(`送審失敗：${error instanceof Error ? error.message : "請確認 API 是否啟動"}`));
  }
  /** API 成功後以資料庫的最新狀態覆蓋前端暫存，避免兩套狀態逐漸不同步。 */
  async function refreshWorkspace(targetRole: Role = role, selectedCode?: string) {
    const remote = await loadPolicyWorkspace(apiEmployeeNoByRole[targetRole]);
    const refreshed = remote.map(policyFromApi);
    setPolicies(refreshed);
    const current = refreshed.find((policy) => policy.code === selectedCode) || refreshed[0];
    if (current) open(current);
  }
  /**
   * 新增規程後畫面可能仍保有儲存前的物件，當中沒有 changeRequestId。
   * 在送審、承認、退回前重查一次，可確保動作一定對到 PostgreSQL 的正確案件。
   */
  async function resolveChangeRequestId(policy: Policy, targetRole: Role = role) {
    if (policy.changeRequestId) return policy.changeRequestId;
    const remote = await loadPolicyWorkspace(apiEmployeeNoByRole[targetRole]);
    const fresh = remote.map(policyFromApi).find((item) => item.code === policy.code);
    if (!fresh?.changeRequestId) throw new Error("找不到此規程的送審草稿；請先儲存草稿並送交承認。");
    return fresh.changeRequestId;
  }
  function departmentApprove(policy: Policy) {
    // 第一關只改變承認階段，不產生版本；發布只能在據點長關卡後發生。
    if (!isDepartmentHead) return;
    const next = {
      ...policy,
      approval: { ...policy.approval, stage: "待據點長承認" as ApprovalStage },
    };
    const all = policies.map((p) => (p.id === next.id ? next : p));
    saveStore(
      all,
      log(
        "部門長承認",
        JSON.stringify(policy.draft),
        JSON.stringify(next.draft),
        next,
      ),
    );
    setNotice("部門長承認處理中…");
    void resolveChangeRequestId(policy, "department_head")
      .then((changeRequestId) => approveChange(apiEmployeeNoByRole.department_head, changeRequestId))
      .then(() => {
        setApprovalSelectedId(null);
        setNotice("已承認，已送交據點長承認（PostgreSQL 已更新）。");
        // 承認交易已完成；刷新畫面失敗不可將成功結果誤顯示為承認失敗。
        return refreshWorkspace("department_head", policy.code).catch(() => {});
      })
      .catch((error) => setNotice(`部門長承認失敗：${error instanceof Error ? error.message : "請確認 API 是否啟動"}`));
  }
  function siteApprove(policy: Policy) {
    // 若預定發布日在未來，保留已承認狀態；否則立即建立不可覆寫的新版本。
    if (!isSiteHead) return;
    if (policy.changeRequestId || policy.approval?.stage === "待據點長承認") {
      setNotice("據點長承認處理中…");
      void resolveChangeRequestId(policy, "site_head")
        .then((changeRequestId) => approveChange(apiEmployeeNoByRole.site_head, changeRequestId))
        .then(() => {
          setApprovalSelectedId(null);
          setNotice("據點長承認已完成；系統已依發布日期更新 PostgreSQL。 ");
          // 已發布的新版本已在資料庫交易內建立，刷新失敗不應覆蓋成功提示。
          return refreshWorkspace("site_head", policy.code).catch(() => {});
        })
        .catch((error) => setNotice(`據點長承認失敗：${error instanceof Error ? error.message : "請確認 API 是否啟動"}`));
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    if (policy.publishDate && policy.publishDate > today) {
      const next = {
        ...policy,
        status: "已承認" as Status,
        approval: {
          ...policy.approval,
          stage: "已承認待發布" as ApprovalStage,
          approvedAt: now(),
        },
      };
      const all = policies.map((p) => (p.id === next.id ? next : p));
      saveStore(
        all,
        log(
          "據點長承認",
          JSON.stringify(policy.draft),
          JSON.stringify(next.draft),
          next,
        ),
      );
      setNotice(`已承認，將於 ${policy.publishDate} 自動發布。`);
      return;
    }
    const last = policy.versions.at(-1)?.number || "0.0";
    const version: Version = {
      id: String(Date.now()),
      number: nextV(last),
      publishedAt: new Date().toISOString().slice(0, 10),
      copy: clone(policy.draft),
      revisionNote: policy.revisionNote || "未填寫修訂說明",
    };
    const next = {
      ...policy,
      status: "發布" as Status,
      versions: [...policy.versions, version],
      approval: { stage: "草稿" as ApprovalStage },
      replacesPolicyId: undefined,
    };
    const all = policies
      .filter((p) => p.id !== policy.replacesPolicyId)
      .map((p) => (p.id === next.id ? next : p));
    saveStore(
      all,
      log(
        "據點長承認",
        JSON.stringify(policy.versions.at(-1)?.copy || {}),
        JSON.stringify(version.copy),
        next,
      ),
    );
    setNotice(`據點長已承認，v${version.number} 已公開。`);
  }
  useEffect(() => {
    const releaseDuePolicies = () => {
      const today = new Date().toISOString().slice(0, 10);
      const due = policies.filter(
        (policy) =>
          policy.approval?.stage === "已承認待發布" &&
          policy.publishDate &&
          policy.publishDate <= today,
      );
      if (!due.length) return;
      const replacedIds = new Set(
        due
          .map((policy) => policy.replacesPolicyId)
          .filter((id): id is number => typeof id === "number"),
      );
      const released = due.map((policy) => {
        const last = policy.versions.at(-1)?.number || "0.0";
        const version: Version = {
          id: `${Date.now()}-${policy.id}`,
          number: nextV(last),
          publishedAt: today,
          copy: clone(policy.draft),
          revisionNote: policy.revisionNote || "定期發布",
        };
        return {
          ...policy,
          status: "發布" as Status,
          versions: [...policy.versions, version],
          approval: { stage: "草稿" as ApprovalStage },
          replacesPolicyId: undefined,
        };
      });
      const next = policies
        .filter((policy) => !replacedIds.has(policy.id))
        .map(
          (policy) => released.find((item) => item.id === policy.id) || policy,
        );
      const nextAudit = released.reduce<Audit[]>(
        (records, policy) => [
          {
            id: `scheduled-${Date.now()}-${policy.id}`,
            at: now(),
            actor: "系統排程",
            action: "發布",
            policy: policy.draft.zh.title || policy.draft.ja.title,
            code: policy.code,
            before: JSON.stringify(policy.versions.at(-2)?.copy || {}),
            after: JSON.stringify(policy.versions.at(-1)?.copy || {}),
            fromVersion: `v${policy.versions.at(-2)?.number || "未發布"}`,
            toVersion: `v${policy.versions.at(-1)?.number || "發布中"}`,
            changes: ["排程發布"],
          },
          ...records,
        ],
        audit,
      );
      saveStore(next, nextAudit);
      // PostgreSQL 的正式排程由後端統一判斷到期日，前端計時器只是觸發入口。
      if (role === "admin") {
        void publishScheduledChanges(apiEmployeeNoByRole.admin)
          .then(() => refreshWorkspace("admin"))
          .catch(() => {});
      }
      setNotice("已依發布日期自動公開新版規程。 ");
    };
    releaseDuePolicies();
    const timer = window.setInterval(releaseDuePolicies, 60000);
    return () => window.clearInterval(timer);
  }, [policies, audit, role]);
  function returnForRevision(policy: Policy, comment: string) {
    // 退回者與意見會同步進入規程資料與 audit，讓 Admin 可追溯原因。
    if (!isDepartmentHead && !isSiteHead) return;
    const returnReason = comment.trim();
    if (!returnReason) {
      setNotice("請先填寫退回意見。");
      return;
    }
    const next = {
      ...policy,
      status: policy.status,
      approval: {
        stage: "退回修改" as ApprovalStage,
        returnedAt: now(),
        returnedBy: name,
        returnReason,
      },
    };
    const all = policies.map((p) => (p.id === next.id ? next : p));
    const nextAudit = log(
      "退回修改",
      JSON.stringify(policy.draft),
      JSON.stringify(next.draft),
      next,
    );
    nextAudit[0] = {
      ...nextAudit[0],
      comment: returnReason,
      changes: ["退回意見"],
    };
    saveStore(all, nextAudit);
    setReturnComments((comments) => ({ ...comments, [policy.id]: "" }));
    setNotice("退回修改處理中…");
    void resolveChangeRequestId(policy, role)
      .then((changeRequestId) => returnChange(apiEmployeeNoByRole[role], changeRequestId, returnReason))
      .then(async () => {
        await refreshWorkspace(role, policy.code);
        setApprovalSelectedId(null);
        setNotice("已退回管理員重新修改（PostgreSQL 已更新）。");
      })
      .catch((error) => setNotice(`退回失敗：${error instanceof Error ? error.message : "請確認 API 是否啟動"}`));
  }
  function disable() {
    if (!isAdmin) return;
    const next = { ...draft, status: "停用" as Status },
      all = policies.map((p) => (p.id === next.id ? next : p)),
      nextAudit = log(
        "停用",
        JSON.stringify(selected.draft),
        "規程已停用",
        next,
      );
    saveStore(all, nextAudit);
    open(next);
    setNotice("規程已停用。");
  }
  function restore(v: Version) {
    // 還原是複製舊內容到新草稿，不會覆蓋既有歷史版本。
    if (!isAdmin) return;
    setDraft({ ...draft, draft: clone(v.copy), status: "草稿" });
    setEditing(true);
    setNotice(`已載入版本 ${v.number} 為草稿；發布後才會建立新版本。`);
  }
  const diff = (a: string, b: string) => {
    const x = a.split("\n").filter(Boolean),
      y = b.split("\n").filter(Boolean);
    return [
      ...x.map((t) => ({ t, k: y.includes(t) ? "same" : "remove" })),
      ...y.filter((t) => !x.includes(t)).map((t) => ({ t, k: "add" })),
    ];
  };
  const approvalQueue = policies.filter((policy) =>
    isDepartmentHead
      ? policy.approval?.stage === "待部門長承認"
      : isSiteHead
        ? policy.approval?.stage === "待據點長承認"
        : false,
  );
  const selectedApproval = approvalQueue.find(
    (policy) => policy.id === approvalSelectedId,
  );
  const selectedAuditPolicy = policies.find(
    (policy) => policy.id === auditPolicyId,
  );
  const selectedAuditEntries = selectedAuditPolicy
    ? audit.filter((entry) => entry.code === selectedAuditPolicy.code)
    : [];
  const filteredAuditEntries = selectedAuditEntries.filter(
    (entry) =>
      auditActionFilter === "全部" || entry.action === auditActionFilter,
  );
  const auditActionOptions: Array<Audit["action"] | "全部"> = [
    "全部",
    ...Array.from(new Set(selectedAuditEntries.map((entry) => entry.action))),
  ];
  const auditPolicyCards = policies.filter((policy) =>
    `${policy.code} ${policy.draft.zh.title} ${policy.draft.ja.title}`
      .toLowerCase()
      .includes(auditSearch.toLowerCase()),
  );
  if (view === "approval")
    return (
      <ApprovalPage onNavigate={guardEditingNavigation}>
        <aside className="sidebar">
          <div className="brand">
            <span className="brand-mark">人</span>
            <div>
              <strong>企業規程庫</strong>
              <small>POLICY CENTER</small>
            </div>
          </div>
          <nav>
            <button className="active">
              <span className="nav-label">
                {ui("✓ 承認待辦", "✓ 承認待ち")}
                {approvalQueue.length > 0 && (
                  <i className="pending-dot">{approvalQueue.length}</i>
                )}
              </span>
            </button>
            <button
              onClick={() => {
                setApprovalSelectedId(null);
                setView("library");
              }}
            >
              {ui("▦ 規程資料庫", "▦ 規程ライブラリ")}
            </button>
          </nav>
        </aside>
        <section className="workspace approval-page">
          <header>
            <div>
              <p className="eyebrow">APPROVAL WORKFLOW</p>
              <h1>承認待ち一覧</h1>
              <p className="sub">
                ご自身の承認段階にある全分類の申請を確認し、承認または差戻しを行います。
              </p>
            </div>
            <button
              className="ghost"
              onClick={() => {
                if (selectedApproval) setApprovalSelectedId(null);
                else setView("library");
              }}
            >
              {selectedApproval
                ? "← 承認待ち一覧へ戻る"
                : "← 規程ライブラリへ戻る"}
            </button>
          </header>
          <div className="approval-flow">
            <span className={isDepartmentHead ? "current" : ""}>
              1. 部門長承認
            </span>
            <i>→</i>
            <span className={isSiteHead ? "current" : ""}>2. 拠点長承認</span>
            <i>→</i>
            <span>3. 公開</span>
          </div>
          <div className="approval-list">
            {approvalQueue.length ? (
              selectedApproval ? (
                [selectedApproval].map((policy) => {
                  const reviewLang = reviewLanguage(policy);
                  const original =
                    policy.versions.at(-1)?.copy[reviewLang].content ||
                    "（首次發布，無原始版本）";
                  const revised = policy.draft[reviewLang].content;
                  return (
                    <article className="approval-card" key={policy.id}>
                      <div className="approval-card-head">
                        <div>
                          <span className="code">{policy.code}</span>
                          <h2>
                            {policy.draft[reviewLang].title ||
                              policy.draft.zh.title}
                          </h2>
                        </div>
                        <span className="status draft">
                          {policy.approval?.stage}
                        </span>
                      </div>
                      <div className="approval-meta">
                        <span>送審：{policy.approval?.submittedAt || "—"}</span>
                        <span>
                          公開予定日：{policy.publishDate || "未設定"}
                        </span>
                      </div>
                      <section className="approval-reason">
                        <b>改訂理由</b>
                        <p>{policy.revisionNote || "改訂理由は未入力です。"}</p>
                      </section>
                      <details className="approval-original">
                        <summary>原文を確認（前回公開版）</summary>
                        <pre>{original}</pre>
                      </details>
                      <section className="approval-diff">
                        <b>変更差分</b>
                        <div className="diff-box">
                          {diff(original, revised).map((row, index) => (
                            <p key={index} className={row.k}>
                              {row.k === "add"
                                ? "+ "
                                : row.k === "remove"
                                  ? "− "
                                  : "　"}
                              {row.t}
                            </p>
                          ))}
                        </div>
                      </section>
                      <label className="approval-comment">
                        <b>差戻しコメント（Admin に表示）</b>
                        <textarea
                          rows={3}
                          value={returnComments[policy.id] || ""}
                          onChange={(event) =>
                            setReturnComments((comments) => ({
                              ...comments,
                              [policy.id]: event.target.value,
                            }))
                          }
                          placeholder="修正が必要な条文、理由、提案を記入してください"
                        />
                      </label>
                      <div className="approval-actions">
                        <button
                          className="ghost danger"
                          onClick={() =>
                            returnForRevision(
                              policy,
                              returnComments[policy.id] || "",
                            )
                          }
                        >
                          差戻して修正依頼
                        </button>
                        <button
                          className="primary"
                          onClick={() =>
                            isDepartmentHead
                              ? departmentApprove(policy)
                              : siteApprove(policy)
                          }
                        >
                          {isDepartmentHead
                            ? "部門長が承認し拠点長へ送付"
                            : "拠点長が承認して公開"}
                        </button>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="approval-case-list">
                  {approvalQueue.map((policy) => {
                    const reviewLang = reviewLanguage(policy);
                    return (
                      <button
                        className="approval-case-row"
                        key={policy.id}
                        onClick={() => setApprovalSelectedId(policy.id)}
                      >
                        <span className="approval-case-order">案件</span>
                        <span className="approval-case-main">
                          <b>{policy.code}</b>
                          <strong>
                            {policy.draft[reviewLang].title ||
                              policy.draft.zh.title}
                          </strong>
                          <small>
                            申請：{policy.approval?.submittedAt || "—"}　·　
                            公開予定日：{policy.publishDate || "未設定"}
                          </small>
                        </span>
                        <span className="status draft">
                          {policy.approval?.stage}
                        </span>
                        <span className="approval-case-arrow">›</span>
                      </button>
                    );
                  })}
                </div>
              )
            ) : (
              <div className="empty">目前沒有待您承認的規程。</div>
            )}
          </div>
        </section>
      </ApprovalPage>
    );
  if (view === "audit")
    return (
      <AuditPage onNavigate={guardEditingNavigation}>
        <aside className="sidebar">
          <div className="brand">
            <span className="brand-mark">人</span>
            <div>
              <strong>企業規程庫</strong>
              <small>POLICY CENTER</small>
            </div>
          </div>
          <nav>
            <button className="active">◷ 修改紀錄</button>
            <button
              onClick={() => {
                setAuditPolicyId(null);
                setView("library");
              }}
            >
              ▦ 規程資料庫
            </button>
          </nav>
        </aside>
        <section className="workspace audit-page">
          <header>
            <div>
              <p className="eyebrow">AUDIT TRAIL</p>
              <h1>
                {selectedAuditPolicy
                  ? `${selectedAuditPolicy.code} 修改紀錄`
                  : "修改紀錄"}
              </h1>
              <p className="sub">
                {selectedAuditPolicy
                  ? "查看此規程的版本比較與完整異動內容。"
                  : "先選擇規程，再查看各規程的修改紀錄。"}
              </p>
            </div>
            <button
              className="ghost"
              onClick={() => {
                if (selectedAuditPolicy) setAuditPolicyId(null);
                else setView("library");
              }}
            >
              {selectedAuditPolicy ? "← 返回規程清單" : "← 返回規程庫"}
            </button>
          </header>
          {selectedAuditPolicy ? (
            <>
              <div className="audit-list">
                {filteredAuditEntries.length ? (
                  filteredAuditEntries.map((a) => (
                    <article className="audit-card" key={a.id}>
                      <div className="audit-top">
                        <span className={`audit-action ${a.action}`}>
                          {a.action}
                        </span>
                        <b>{a.policy}</b>
                        <time>{a.at}</time>
                      </div>
                      <p>
                        <strong>操作人：</strong>
                        {a.actor}　<strong>規程：</strong>
                        {a.code}
                      </p>
                      <div className="audit-summary">
                        <div className="audit-version-flow">
                          <span>修改前版本</span>
                          <b>{a.fromVersion || "歷史版本"}</b>
                          <i>→</i>
                          <span>修改後版本</span>
                          <b>{a.toVersion || "草稿"}</b>
                        </div>
                        <div className="audit-changes">
                          <small>修改項目</small>
                          <div>
                            {(a.changes?.length
                              ? a.changes
                              : changedFields(a.before, a.after)
                            ).map((change) => (
                              <span key={change}>{change}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      {a.comment && (
                        <section className="audit-comment">
                          <b>退回意見</b>
                          <p>{a.comment}</p>
                        </section>
                      )}
                    </article>
                  ))
                ) : (
                  <div className="empty">此規程尚未有修改紀錄。</div>
                )}
              </div>
              <section className="version-section audit-version-section">
                <div className="audit-version-head">
                  <div>
                    <h3>版本紀錄與差異比較</h3>
                    <p>選擇規程與任意兩個版本，查看內容差異。</p>
                  </div>
                  <label>
                    規程：{selectedAuditPolicy.code} ·{" "}
                    {selectedAuditPolicy.draft[lang].title ||
                      selectedAuditPolicy.draft.zh.title}
                  </label>
                </div>
                {versions.length ? (
                  <>
                    <div className="compare-pickers">
                      <label>
                        舊版本
                        <select
                          value={compare[0]}
                          onChange={(e) =>
                            setCompare([+e.target.value, compare[1]])
                          }
                        >
                          {versions.map((v, i) => (
                            <option key={v.id} value={i}>
                              v{v.number} · {v.publishedAt}
                            </option>
                          ))}
                        </select>
                      </label>
                      <span>→</span>
                      <label>
                        新版本
                        <select
                          value={compare[1]}
                          onChange={(e) =>
                            setCompare([compare[0], +e.target.value])
                          }
                        >
                          {versions.map((v, i) => (
                            <option key={v.id} value={i}>
                              v{v.number} · {v.publishedAt}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="diff-box">
                      {diff(
                        versions[compare[0]]?.copy[lang].content || "",
                        versions[compare[1]]?.copy[lang].content || "",
                      ).map((r, i) => (
                        <p key={i} className={r.k}>
                          {r.k === "add"
                            ? "+ "
                            : r.k === "remove"
                              ? "− "
                              : "　"}
                          {r.t}
                        </p>
                      ))}
                    </div>
                    {isAdmin && (
                      <div className="restore-row">
                        {versions.map((v) => (
                          <button
                            className="ghost"
                            key={v.id}
                            onClick={() => restore(v)}
                          >
                            將 v{v.number} 載入草稿
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="empty">此規程尚未發布任何版本。</div>
                )}
              </section>
              <div className="audit-filter-bar">
                <label>
                  修改類型
                  <select
                    value={auditActionFilter}
                    onChange={(event) =>
                      setAuditActionFilter(
                        event.target.value as Audit["action"] | "全部",
                      )
                    }
                  >
                    {auditActionOptions.map((action) => (
                      <option key={action} value={action}>
                        {action === "全部" ? "全部修改" : action}
                      </option>
                    ))}
                  </select>
                </label>
                <span>共 {filteredAuditEntries.length} 筆紀錄</span>
              </div>
            </>
          ) : (
            <>
              <div className="toolbar audit-search-toolbar">
                <label className="search">
                  ⌕{" "}
                  <input
                    value={auditSearch}
                    onChange={(event) => setAuditSearch(event.target.value)}
                    placeholder="搜尋規程名稱或代碼"
                  />
                </label>
                <span className="result-count">
                  共 {auditPolicyCards.length} 項
                </span>
              </div>
              <div className="audit-policy-grid">
                {auditPolicyCards.map((policy) => {
                  const entries = audit.filter(
                    (entry) => entry.code === policy.code,
                  );
                  return (
                    <button
                      className="audit-policy-card"
                      key={policy.id}
                      onClick={() => {
                        setAuditActionFilter("全部");
                        setAuditPolicyId(policy.id);
                        setSelectedId(policy.id);
                        setCompare([
                          Math.max(0, policy.versions.length - 2),
                          Math.max(0, policy.versions.length - 1),
                        ]);
                      }}
                    >
                      <span className="code">{policy.code}</span>
                      <h2>
                        {policy.draft[lang].title || policy.draft.zh.title}
                      </h2>
                      <p>{policy.category}</p>
                      <div className="audit-policy-meta">
                        <span className="status draft">
                          {policyStatusLabel(policy)}
                        </span>
                        <span>已發布 {policy.versions.length} 版</span>
                      </div>
                      <footer>
                        <b>{entries.length} 筆異動</b>
                        <span>{entries[0]?.at || "尚無紀錄"}　›</span>
                      </footer>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </AuditPage>
    );
  return (
    <PolicyLibraryPage onNavigate={guardEditingNavigation}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">人</span>
          <div>
            <strong>企業規程庫</strong>
            <small>POLICY CENTER</small>
          </div>
        </div>
        <nav>
          <button className="active">
            {ui("▦ 規程資料庫", "▦ 規程ライブラリ")}
          </button>
          {isAdmin && (
            <button
              onClick={() => {
                setAuditPolicyId(null);
                setView("audit");
              }}
            >
              ◷ 修改紀錄
            </button>
          )}
          {(isDepartmentHead || isSiteHead) && (
            <button
              onClick={() => {
                setApprovalSelectedId(null);
                setView("approval");
              }}
            >
              <span className="nav-label">
                {ui("✓ 承認待辦", "✓ 承認待ち")}
                {approvalQueue.length > 0 && (
                  <i className="pending-dot">{approvalQueue.length}</i>
                )}
              </span>
            </button>
          )}
        </nav>
        <div className="sidebar-foot">
          <div className="avatar">
            {role === "admin"
              ? "管"
              : role === "department_head"
                ? "部"
                : role === "site_head"
                  ? "據"
                  : "員"}
          </div>
          <div>
            <b>{name}</b>
            <small>
              {role === "admin"
                ? "Admin · 可管理規程"
                : role === "department_head"
                  ? "部門長 · 第一次承認"
                  : role === "site_head"
                    ? "拠点長 · 最終承認"
                    : "Employee · 僅可查看"}
            </small>
          </div>
          <label className="role-switcher">
            <span>角色預覽</span>
            <select
              value={role}
              onChange={(event) =>
                changePreviewRole(event.target.value as Role)
              }
              aria-label="切換預覽角色"
            >
              <option value="admin">Admin</option>
              <option value="department_head">部門長</option>
              <option value="site_head">據點長</option>
              <option value="employee">Employee</option>
            </select>
          </label>
        </div>
      </aside>
      <section className="workspace">
        <header>
          <div>
            <p className="eyebrow">
              {ui("企業規程管理系統", "企業規程管理システム")}
            </p>
            <h1>{ui("企業規程資料庫", "企業規程ライブラリ")}</h1>
            <p className="sub">
              {isAdmin
                ? "可編輯草稿、發布新版本與管理狀態。"
                : ui("目前為僅查看模式。", "現在は閲覧モードです。")}
            </p>
          </div>
          {isAdmin && (
            <button
              className="primary"
              onClick={() => {
                const p: Policy = {
                  id: Date.now(),
                  category: category === "全部規程" ? "全社基本" : category,
                  code: policyCode(
                    category === "全部規程" ? "全社基本" : category,
                    "",
                  ),
                  effectiveDate: "",
                  publishDate: "",
                  status: "草稿",
                  approval: { stage: "草稿" },
                  draft: { zh: emptyCopy(), ja: emptyCopy() },
                  versions: [],
                };
                setSelectedId(p.id);
                setDraft(p);
                setEditing(true);
              }}
            >
              ＋ 新增規程
            </button>
          )}
        </header>
        {notice && <div className="notice">✓ {notice}</div>}
        <div className="toolbar">
          <label className="search">
            ⌕{" "}
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={ui(
                "搜尋規程名稱、代碼或內容",
                "規程名・コード・本文を検索",
              )}
            />
          </label>
          {role !== "employee" && statusFilter === "全部" && (
            <select
              value={sortMode}
              onChange={(event) =>
                setSortMode(event.target.value as "status" | "updated")
              }
              aria-label="規程排序方式"
            >
              <option value="status">{ui("依狀態排序", "状態順")}</option>
              <option value="updated">
                {ui("依最新修改時間", "最終更新順")}
              </option>
            </select>
          )}
          <span className="result-count">
            {ui(`共 ${list.length} 項`, `${list.length} 件`)}
          </span>
        </div>
        <nav className="category-pages" aria-label="規程分類專屬頁面">
          {categoryPages.map((item) => (
            <button
              key={item}
              className={category === item ? "active" : ""}
              onClick={() => switchCategoryPage(item)}
            >
              {item}
              <span>
                {item === "全部規程"
                  ? visiblePolicies.length
                  : visiblePolicies.filter((policy) => policy.category === item)
                      .length}
              </span>
            </button>
          ))}
        </nav>
        {role !== "employee" && (
          <div className="status-bookmarks" aria-label="依狀態篩選規程">
            {visibleStatusOptions.map((status) => (
              <button
                key={status}
                className={statusFilter === status ? "active" : ""}
                onClick={() => switchStatusFilter(status)}
              >
                <span>{statusName(status)}</span>
                <b>{statusCounts[status]}</b>
              </button>
            ))}
          </div>
        )}
        <div className="content-grid">
          <div className="reg-list">
            {list.map((p) => (
              <button
                key={p.id}
                className={`reg-card ${p.id === selectedId ? "selected" : ""}`}
                onClick={() => open(p)}
              >
                <div className="card-top">
                  <span className="code">{p.code}</span>
                  <span className="card-statuses">
                    <span
                      className={`status ${policyStatusTone(p)}`}
                    >
                      {statusName(policyStatusLabel(p))}
                    </span>
                    {p.replacesPolicyId && (
                      <span className="status updating">
                        {statusName("規程內容更新版本")}
                      </span>
                    )}
                  </span>
                </div>
                <h3>{policyCopy(p)[lang].title || policyCopy(p).zh.title}</h3>
                <p>
                  {p.category} · {lang === "zh" ? "中文" : "日文"}
                </p>
                <footer>
                  <span>最新版本 {p.versions.at(-1)?.number || "未發布"}</span>
                  <time>{p.effectiveDate || "生效日待定"}</time>
                </footer>
              </button>
            ))}
          </div>
          {hasNoEmployeePolicies ? (
            <article className="detail" aria-label="尚無可查看的已發布規程" />
          ) : (
            <article className="detail">
              <div className="detail-head">
                <div>
                  <p className="eyebrow">
                    {selected.category} · {selected.code || "NEW"}
                  </p>
                  <h2>
                    {editing
                      ? "編輯草稿"
                      : displayedCopy[selectedDisplayLang].title}
                  </h2>
                  <div className="detail-meta">
                    <span className="meta-statuses">
                      <span
                        className={`status ${policyStatusTone(selected)}`}
                      >
                        {statusName(policyStatusLabel(selected))}
                      </span>
                      {selected.replacesPolicyId && (
                        <span className="status updating">
                          {statusName("規程內容更新版本")}
                        </span>
                      )}
                    </span>
                    <span>最新版本 {versions.at(-1)?.number || "未發布"}</span>
                    <span>生效日 {selected.effectiveDate || "待定"}</span>
                    <span>
                      發布日 {selected.publishDate || "據點長承認後立即發布"}
                    </span>
                    {role !== "employee" && selected.approval?.stage && (
                      <span>核准狀態：{selected.approval.stage}</span>
                    )}
                  </div>
                </div>
                {isAdmin && !editing && !isApprovalLocked && (
                  <div className="actions">
                    {canChooseChangeType ? (
                      <>
                        <button
                          className="ghost"
                          onClick={() => {
                            setDraft({
                              ...clone(selected),
                              changeType: "typo",
                            });
                            setEditing(true);
                          }}
                        >
                          ✎ 純錯字修改
                        </button>
                        <button
                          className="ghost"
                          onClick={() => {
                            const pendingUpdate = policies.find(
                              (policy) =>
                                policy.replacesPolicyId === selected.id,
                            );
                            if (pendingUpdate) {
                              open(pendingUpdate);
                              setEditing(true);
                              setNotice("已開啟此規程的規程內容更新版本卡片。");
                              return;
                            }
                            setDraft({
                              ...clone(selected),
                              changeType: "content",
                            });
                            setEditing(true);
                          }}
                        >
                          ✎ 修改內容事項
                        </button>
                      </>
                    ) : (
                      <button
                        className="ghost"
                        onClick={() => {
                          setDraft(clone(selected));
                          setEditing(true);
                        }}
                      >
                        ✎ 編輯草稿
                      </button>
                    )}
                    {selected.approval?.stage === "已承認待發布" &&
                    selected.changeType === "typo" ? (
                      <span />
                    ) : (
                      <button className="primary" onClick={submitForApproval}>
                        送交部門長承認
                      </button>
                    )}
                    {selected.status !== "停用" && (
                      <button className="ghost danger" onClick={disable}>
                        停用
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="language-bar">
                <span>{isApprover ? "審査表示：日本語優先" : "顯示語言"}</span>
                {!isApprover && (
                  <>
                    <button
                      className={lang === "zh" ? "selected-lang" : ""}
                      onClick={() => setLang("zh")}
                    >
                      繁體中文
                    </button>
                    <button
                      className={lang === "ja" ? "selected-lang" : ""}
                      onClick={() => setLang("ja")}
                    >
                      日本語
                    </button>
                  </>
                )}
              </div>
              {editing ? (
                <form onSubmit={saveDraft}>
                  {draft.status !== "停用" &&
                    (draft.versions.length > 0 ||
                      draft.approval?.stage === "已承認待發布") && (
                      <div className="change-type-guide">
                        <b>
                          {draft.approval?.stage === "退回修改"
                            ? "退回修改：不區分修改類型，完成修正後必須重新送交承認。"
                            : draft.changeType === "typo"
                              ? draft.approval?.stage === "已承認待發布"
                                ? "純錯字修改：沿用既有承認，將於發布日期公開。"
                                : draft.status === "發布"
                                  ? "純錯字修改：可不儲存草稿，直接發布新版。"
                                  : "純錯字修改：送審後也需依序完成承認。"
                              : "修改內容事項：送審後會先停用原公開版本，再依序承認。"}
                        </b>
                        {draft.approval?.stage !== "退回修改" && (
                          <span>可在下方「變更類型」切換流程。</span>
                        )}
                      </div>
                    )}
                  <div className="form-grid">
                    <label>
                      規程編號
                      <div className="policy-code-input">
                        <span>{categoryCodePrefix(draft.category)}-</span>
                        <input
                          required
                          inputMode="numeric"
                          maxLength={4}
                          pattern="[0-9]{1,4}"
                          aria-label="規程編號後四位數字"
                          placeholder="0001"
                          // 以「是否為這次新增的草稿」判斷，而不是用預設 DHT2-0000 是否存在判斷。
                          // 否則人事分類若已曾建立過 0000，新的草稿會被誤鎖定。
                          readOnly={!isNewPolicy}
                          value={editablePolicyCodeSuffix(draft.code)}
                          onFocus={(event) => event.currentTarget.select()}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              code: policyCode(draft.category, e.target.value),
                            })
                          }
                        />
                      </div>
                      {!isNewPolicy && (
                        <small>規程已建立後，編號會作為資料庫主鍵，因此不可變更。</small>
                      )}
                    </label>
                    <label>
                      規程分類
                      <input value={draft.category} readOnly />
                    </label>
                    <label>
                      生效日期
                      <input
                        type="date"
                        value={draft.effectiveDate}
                        onChange={(e) =>
                          setDraft({ ...draft, effectiveDate: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      發布日期
                      <input
                        type="date"
                        value={draft.publishDate || ""}
                        onChange={(e) =>
                          setDraft({ ...draft, publishDate: e.target.value })
                        }
                      />
                    </label>
                    {draft.status !== "停用" &&
                    (draft.versions.length > 0 ||
                      draft.approval?.stage === "已承認待發布") &&
                    draft.approval?.stage !== "退回修改" ? (
                      <label>
                        變更類型
                        <select
                          value={draft.changeType || "content"}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              changeType: e.target.value as ChangeType,
                            })
                          }
                        >
                          <option value="content">
                            修改內容事項（需承認）
                          </option>
                          <option value="typo">
                            純錯字修改
                            {draft.approval?.stage === "已承認待發布"
                              ? "（沿用既有承認）"
                              : "（需承認）"}
                          </option>
                        </select>
                      </label>
                    ) : (
                      <label>
                        核准狀態
                        <input
                          value={
                            draft.approval?.stage === "退回修改"
                              ? "退回修改（需重新承認）"
                              : "草稿"
                          }
                          readOnly
                        />
                      </label>
                    )}
                  </div>
                  <label>
                    附件／表單（以逗號分隔）
                    <input
                      value={(draft.attachments || []).join("、")}
                      placeholder="例如：請假申請表、任用核准單"
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          attachments: e.target.value
                            .split(/[、,]/)
                            .map((item) => item.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </label>
                  <label>
                    關聯規程（以逗號分隔）
                    <input
                      value={(draft.relatedPolicies || []).join("、")}
                      placeholder="例如：HR-002 出勤與請假管理規程"
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          relatedPolicies: e.target.value
                            .split(/[、,]/)
                            .map((item) => item.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </label>
                  <label>
                    本次修訂說明（發布時會一併記錄）
                    <textarea
                      rows={2}
                      value={draft.revisionNote || ""}
                      placeholder="例如：第 2 條新增主管核准流程"
                      onChange={(e) =>
                        setDraft({ ...draft, revisionNote: e.target.value })
                      }
                    />
                  </label>
                  <div className="edit-language">
                    <b>正在編輯：{lang === "zh" ? "繁體中文" : "日本語"}</b>
                    <div>
                      <button type="button" onClick={() => setLang("zh")}>
                        繁中
                      </button>
                      <button type="button" onClick={() => setLang("ja")}>
                        日本語
                      </button>
                    </div>
                  </div>
                  <label>
                    規程名稱
                    <input
                      required
                      value={draft.draft[lang].title}
                      onChange={(e) => update("title", e.target.value)}
                    />
                  </label>
                  <label>
                    摘要
                    <textarea
                      rows={2}
                      value={draft.draft[lang].summary}
                      onChange={(e) => update("summary", e.target.value)}
                    />
                  </label>
                  <StructureEditor
                    chapters={draft.draft[lang].chapters}
                    onChange={updateChapters}
                  />
                  <Tables
                    editing
                    tables={draft.draft[lang].tables}
                    onChange={(x) => update("tables", x)}
                  />
                  <div className="form-actions">
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        setDraft(clone(selected));
                        setEditing(false);
                      }}
                    >
                      取消
                    </button>
                    {draft.changeType === "typo" &&
                      draft.status === "發布" &&
                      !draft.replacesPolicyId &&
                      draft.approval?.stage !== "退回修改" && (
                        <button
                          type="button"
                          className="primary"
                          onClick={publishTypoFix}
                        >
                          發布錯字修正
                        </button>
                      )}
                    <button className="ghost">儲存草稿</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="summary">
                    <b>
                      {selectedDisplayLang === "zh" ? "規程摘要" : "規程概要"}
                    </b>
                    <p>{displayedCopy[selectedDisplayLang].summary}</p>
                  </div>
                  <div className="policy-structure">
                    {(
                      displayedCopy[selectedDisplayLang].chapters ||
                      chaptersFromContent(
                        displayedCopy[selectedDisplayLang].content,
                      )
                    ).map((chapter) => (
                      <section className="policy-chapter" key={chapter.id}>
                        <h3>{chapter.title}</h3>
                        {chapter.articles.map((article) => (
                          <article className="policy-article" key={article.id}>
                            <b>{article.title}</b>
                            <p>
                              {article.text.replace(article.title, "").trim() ||
                                article.text}
                            </p>
                          </article>
                        ))}
                      </section>
                    ))}
                  </div>
                  <Tables tables={displayedCopy[selectedDisplayLang].tables} />
                  <section className="policy-links">
                    <div>
                      <b>附件／表單</b>
                      <p>
                        {selected.attachments?.length
                          ? selected.attachments.join("、")
                          : "尚未設定附件或表單。"}
                      </p>
                    </div>
                    <div>
                      <b>關聯規程</b>
                      <p>
                        {selected.relatedPolicies?.length
                          ? selected.relatedPolicies.join("、")
                          : "尚未設定關聯規程。"}
                      </p>
                    </div>
                  </section>
                  <section className="revision-note">
                    <b>最新修訂說明</b>
                    <p>
                      {versions.at(-1)?.revisionNote ||
                        selected.revisionNote ||
                        "尚未填寫修訂說明。"}
                    </p>
                  </section>
                  {isAdmin && hasSavedDraft(selected) && (
                    <section className="pending-draft">
                      <div className="pending-draft-head">
                        <b>已儲存的編輯草稿</b>
                        <span>
                          {selected.approval?.stage === "草稿"
                            ? "尚未送審"
                            : selected.approval?.stage}
                        </span>
                      </div>
                      <small>
                        變更類型：
                        {selected.changeType === "typo"
                          ? "純錯字修改（Admin 可直接發布）"
                          : "修改內容事項（需承認）"}
                      </small>
                      <h3>
                        {selected.draft[lang].title || selected.draft.zh.title}
                      </h3>
                      <p>{selected.draft[lang].summary}</p>
                      <details>
                        <summary>查看已儲存的編輯內容</summary>
                        <pre>{selected.draft[lang].content}</pre>
                      </details>
                    </section>
                  )}
                  {isAdmin && selected.approval?.stage === "退回修改" && (
                    <section className="revision-note return-comment">
                      <b>承認退回意見</b>
                      <p>
                        {selected.approval.returnReason || "尚未填寫退回意見。"}
                      </p>
                      {selected.approval.returnedAt && (
                        <small>
                          退回人：{selected.approval.returnedBy || "承認者"}　
                          退回時間：{selected.approval.returnedAt}
                        </small>
                      )}
                    </section>
                  )}
                </>
              )}
            </article>
          )}
        </div>
      </section>
    </PolicyLibraryPage>
  );
}
