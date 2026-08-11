"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";

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
type PolicyFilter = "全部" | Status | Exclude<ApprovalStage, "草稿">;
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
};
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
const normalizePolicy = (value: Policy): Policy => ({
  ...value,
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
});
const ordinal = (number: number) =>
  ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"][number - 1] ||
  String(number);
const contentFromChapters = (chapters: Chapter[]) =>
  chapters
    .flatMap((chapter) =>
      chapter.articles.map((article) => `${article.title}　${article.text}`),
    )
    .join("\n\n");
const initial: Policy[] = [
  {
    id: 1,
    code: "HR-001",
    category: "任用管理",
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
    code: "HR-002",
    category: "出勤休假",
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

function Tables({
  tables,
  editing,
  onChange,
}: {
  tables: unknown;
  editing?: boolean;
  onChange?: (v: string[][][]) => void;
}) {
  const safeTables = normalizeTables(tables);
  const change = (i: number, r: number, c: number, value: string) =>
    onChange?.(
      safeTables.map((t, ti) =>
        ti === i
          ? t.map((row, ri) =>
              ri === r ? row.map((cell, ci) => (ci === c ? value : cell)) : row,
            )
          : t,
      ),
    );
  const addTable = () =>
    onChange?.([
      ...safeTables,
      [
        ["欄位 1", "欄位 2", "欄位 3"],
        ["", "", ""],
      ],
    ]);
  return (
    <div className="policy-tables">
      {safeTables.map((t, i) => (
        <div className="policy-table" key={i}>
          <span className="table-caption">表格 {i + 1}</span>
          <table>
            <tbody>
              {t.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, col) =>
                    editing ? (
                      <td key={col}>
                        <input
                          value={cell}
                          onChange={(e) => change(i, r, col, e.target.value)}
                          placeholder={r === 0 ? "欄位名稱" : "輸入文字"}
                        />
                      </td>
                    ) : r === 0 ? (
                      <th key={col}>{cell}</th>
                    ) : (
                      <td key={col}>{cell}</td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {editing && (
            <div className="table-tools">
              <button
                type="button"
                onClick={() =>
                  onChange?.(
                    safeTables.map((x, ti) =>
                      ti === i ? [...x, Array(x[0]?.length || 3).fill("")] : x,
                    ),
                  )
                }
              >
                ＋ 列
              </button>
              <button
                type="button"
                onClick={() =>
                  onChange?.(
                    safeTables.map((x, ti) =>
                      ti === i ? x.map((row) => [...row, ""]) : x,
                    ),
                  )
                }
              >
                ＋ 欄
              </button>
              <button
                type="button"
                onClick={() =>
                  onChange?.(safeTables.filter((_, ti) => ti !== i))
                }
              >
                刪除表格
              </button>
            </div>
          )}
        </div>
      ))}
      {editing && (
        <button type="button" className="ghost" onClick={addTable}>
          ＋ 新增表格
        </button>
      )}
    </div>
  );
}

function StructureEditor({
  chapters,
  onChange,
}: {
  chapters: Chapter[];
  onChange: (chapters: Chapter[]) => void;
}) {
  const addChapter = () =>
    onChange([
      ...chapters,
      {
        id: String(Date.now()),
        title: `第${ordinal(chapters.length + 1)}章`,
        articles: [],
      },
    ]);
  const addArticle = (chapterIndex: number) =>
    onChange(
      chapters.map((chapter, index) =>
        index !== chapterIndex
          ? chapter
          : {
              ...chapter,
              articles: [
                ...chapter.articles,
                {
                  id: `${Date.now()}-${chapterIndex}`,
                  title: `第${ordinal(chapter.articles.length + 1)}條`,
                  text: "",
                },
              ],
            },
      ),
    );
  const updateText = (
    chapterIndex: number,
    articleIndex: number,
    text: string,
  ) =>
    onChange(
      chapters.map((chapter, index) =>
        index !== chapterIndex
          ? chapter
          : {
              ...chapter,
              articles: chapter.articles.map((article, articlePosition) =>
                articlePosition === articleIndex
                  ? { ...article, text }
                  : article,
              ),
            },
      ),
    );
  const removeArticle = (chapterIndex: number, articleIndex: number) =>
    onChange(
      chapters.map((chapter, index) =>
        index !== chapterIndex
          ? chapter
          : {
              ...chapter,
              articles: chapter.articles.filter(
                (_, position) => position !== articleIndex,
              ),
            },
      ),
    );
  return (
    <section className="structure-editor">
      <div className="structure-editor-head">
        <div>
          <b>章節與條文</b>
          <small>使用新增建立章節與條號；僅輸入條文內容。</small>
        </div>
        <button type="button" className="ghost" onClick={addChapter}>
          ＋ 新增章節
        </button>
      </div>
      {chapters.map((chapter, chapterIndex) => (
        <div className="chapter-editor" key={chapter.id}>
          <div className="chapter-title">
            {chapter.title}
            <button type="button" onClick={() => addArticle(chapterIndex)}>
              ＋ 新增條文
            </button>
          </div>
          {chapter.articles.map((article, articleIndex) => (
            <div className="article-editor" key={article.id}>
              <b>{article.title}</b>
              <textarea
                rows={3}
                value={article.text}
                placeholder="輸入條文內容"
                onChange={(event) =>
                  updateText(chapterIndex, articleIndex, event.target.value)
                }
              />
              <button
                type="button"
                className="remove-article"
                onClick={() => removeArticle(chapterIndex, articleIndex)}
              >
                刪除
              </button>
            </div>
          ))}
        </div>
      ))}
      {!chapters.length && (
        <div className="empty">尚未建立條文。請先新增章節，再新增條文。</div>
      )}
    </section>
  );
}

export default function Home() {
  const [policies, setPolicies] = useState(initial),
    [selectedId, setSelectedId] = useState(1),
    [lang, setLang] = useState<Lang>("zh"),
    [role, setRole] = useState<Role>("employee"),
    [name, setName] = useState("Employee"),
    [view, setView] = useState<"library" | "audit" | "approval">("library"),
    [editing, setEditing] = useState(false),
    [draft, setDraft] = useState<Policy>(clone(initial[0])),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState("全部分類"),
    [statusFilter, setStatusFilter] = useState<PolicyFilter>("全部"),
    [notice, setNotice] = useState(""),
    [audit, setAudit] = useState<Audit[]>([]),
    [returnComments, setReturnComments] = useState<Record<number, string>>({}),
    [approvalSelectedId, setApprovalSelectedId] = useState<number | null>(null),
    [compare, setCompare] = useState<[number, number]>([0, 0]);
  useEffect(() => {
    try {
      const s = localStorage.getItem("hr-policy-v8");
      if (s) {
        const d = JSON.parse(s) as { policies: Policy[]; audit: Audit[] };
        const normalized = d.policies.map(normalizePolicy);
        setPolicies(normalized);
        setAudit(d.audit || []);
        setSelectedId(normalized[0]?.id || 1);
        setDraft(clone(normalized[0] || initial[0]));
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
          setName(x.name);
        }
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const saveStore = (next: Policy[], nextAudit: Audit[] = audit) => {
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
  const hasSavedDraft = (policy: Policy) =>
    policy.versions.length > 0 &&
    JSON.stringify(policy.draft) !== JSON.stringify(releasedCopy(policy));
  const displayedCopy = releasedCopy(selected);
  const isApprovalLocked = ["待部門長承認", "待據點長承認"].includes(
    selected.approval?.stage || "",
  );
  const canChooseChangeType =
    selected.versions.length > 0 || selected.approval?.stage === "已承認待發布";
  const policyStatusLabel = (policy: Policy) => {
    if (role === "employee") return "發布";
    if (policy.status === "停用待更新") return "停用待更新";
    if (policy.changeType === "content" && policy.status === "停用")
      return "停用";
    return policy.approval?.stage && policy.approval.stage !== "草稿"
      ? policy.approval.stage
      : policy.status;
  };
  const statusOptions: PolicyFilter[] = [
    "全部",
    "草稿",
    "待部門長承認",
    "待據點長承認",
    "退回修改",
    "已承認待發布",
    "發布",
    "停用待更新",
    "停用",
  ];
  const statusCounts = Object.fromEntries(
    statusOptions.map((status) => [
      status,
      status === "全部"
        ? visiblePolicies.length
        : visiblePolicies.filter(
            (policy) => policyStatusLabel(policy) === status,
          ).length,
    ]),
  ) as Record<PolicyFilter, number>;
  const changePreviewRole = (next: Role) => {
    localStorage.setItem("hr-policy-role-preview", next);
    setRole(next);
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
  const categories = [
    "全部分類",
    ...Array.from(new Set(visiblePolicies.map((x) => x.category))),
  ];
  const list = useMemo(
    () =>
      visiblePolicies.filter(
        (p) =>
          (category === "全部分類" || p.category === category) &&
          (role === "employee" ||
            statusFilter === "全部" ||
            policyStatusLabel(p) === statusFilter) &&
          `${p.code} ${releasedCopy(p).zh.title} ${releasedCopy(p).ja.title}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [visiblePolicies, category, search, role, statusFilter],
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
    setSelectedId(p.id);
    setDraft(clone(p));
    setEditing(false);
    setCompare([
      Math.max(0, p.versions.length - 2),
      Math.max(0, p.versions.length - 1),
    ]);
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
  function saveDraft(e: FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;
    if (
      ["待部門長承認", "待據點長承認"].includes(draft.approval?.stage || "")
    ) {
      setNotice("此規程已送交承認，請等待承認完成或退回後再修改。");
      return;
    }
    const exists = policies.some((p) => p.id === draft.id),
      before = exists ? JSON.stringify(selected.draft) : "（新增規程）",
      savedDraft =
        exists && draft.status === "停用" && hasSavedDraft(draft)
          ? { ...draft, status: "停用待更新" as Status }
          : draft,
      next = exists
        ? policies.map((p) => (p.id === savedDraft.id ? savedDraft : p))
        : [savedDraft, ...policies],
      nextAudit = log(
        exists ? "修改草稿" : "新增",
        before,
        JSON.stringify(savedDraft.draft),
        savedDraft,
      );
    saveStore(next, nextAudit);
    open(savedDraft);
    setNotice("草稿已儲存；尚未建立發布版本。");
  }
  function submitForApproval() {
    if (!isAdmin) return;
    const next = {
        ...draft,
        status: draft.versions.length
          ? ("停用待更新" as Status)
          : ("草稿" as Status),
        approval: {
          stage: "待部門長承認" as ApprovalStage,
          submittedAt: now(),
        },
      },
      all = policies.map((p) => (p.id === next.id ? next : p)),
      nextAudit = log(
        "送審",
        JSON.stringify(selected.versions.at(-1)?.copy || {}),
        JSON.stringify(next.draft),
        next,
      );
    saveStore(all, nextAudit);
    open(next);
    setNotice(
      draft.versions.length
        ? "原公開版本已停用，已送交部門長承認。"
        : "已送交部門長承認。",
    );
  }
  function departmentApprove(policy: Policy) {
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
    setNotice("已承認，已送交據點長承認。");
  }
  function siteApprove(policy: Policy) {
    if (!isSiteHead) return;
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
    };
    const all = policies.map((p) => (p.id === next.id ? next : p));
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
        };
      });
      const next = policies.map(
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
      setNotice("已依發布日期自動公開新版規程。 ");
    };
    releaseDuePolicies();
    const timer = window.setInterval(releaseDuePolicies, 60000);
    return () => window.clearInterval(timer);
  }, [policies, audit]);
  function returnForRevision(policy: Policy, comment: string) {
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
    setNotice("已退回管理員重新修改。");
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
  if (view === "approval")
    return (
      <main>
        <aside className="sidebar">
          <div className="brand">
            <span className="brand-mark">人</span>
            <div>
              <strong>人資規程庫</strong>
              <small>HR POLICY CENTER</small>
            </div>
          </div>
          <nav>
            <button className="active">
              <span className="nav-label">
                ✓ 承認待辦
                {approvalQueue.length > 0 && <i className="pending-dot" />}
              </span>
            </button>
            <button
              onClick={() => {
                setApprovalSelectedId(null);
                setView("library");
              }}
            >
              ▦ 規程資料庫
            </button>
          </nav>
        </aside>
        <section className="workspace approval-page">
          <header>
            <div>
              <p className="eyebrow">APPROVAL WORKFLOW</p>
              <h1>{isDepartmentHead ? "部門長承認" : "據點長承認"}</h1>
              <p className="sub">
                查看原文、前後差異、改訂理由與預定發布日期後，進行承認或退回。
              </p>
            </div>
            <button
              className="ghost"
              onClick={() => {
                if (selectedApproval) setApprovalSelectedId(null);
                else setView("library");
              }}
            >
              {selectedApproval ? "← 返回待承認清單" : "← 返回規程庫"}
            </button>
          </header>
          <div className="approval-flow">
            <span className={isDepartmentHead ? "current" : ""}>
              1. 部門長承認
            </span>
            <i>→</i>
            <span className={isSiteHead ? "current" : ""}>2. 據點長承認</span>
            <i>→</i>
            <span>3. 公開發布</span>
          </div>
          <div className="approval-list">
            {approvalQueue.length ? (
              selectedApproval ? (
                [selectedApproval].map((policy) => {
                  const original =
                    policy.versions.at(-1)?.copy[lang].content ||
                    "（首次發布，無原始版本）";
                  const revised = policy.draft[lang].content;
                  return (
                    <article className="approval-card" key={policy.id}>
                      <div className="approval-card-head">
                        <div>
                          <span className="code">{policy.code}</span>
                          <h2>
                            {policy.draft[lang].title || policy.draft.zh.title}
                          </h2>
                        </div>
                        <span className="status draft">
                          {policy.approval?.stage}
                        </span>
                      </div>
                      <div className="approval-meta">
                        <span>送審：{policy.approval?.submittedAt || "—"}</span>
                        <span>
                          預定發布日：{policy.effectiveDate || "待設定"}
                        </span>
                      </div>
                      <section className="approval-reason">
                        <b>改訂理由</b>
                        <p>{policy.revisionNote || "未填寫改訂理由。"}</p>
                      </section>
                      <details className="approval-original">
                        <summary>查看原文（上一公開版本）</summary>
                        <pre>{original}</pre>
                      </details>
                      <section className="approval-diff">
                        <b>前後差異</b>
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
                        <b>退回意見（Admin 可見）</b>
                        <textarea
                          rows={3}
                          value={returnComments[policy.id] || ""}
                          onChange={(event) =>
                            setReturnComments((comments) => ({
                              ...comments,
                              [policy.id]: event.target.value,
                            }))
                          }
                          placeholder="請說明需調整的條文、原因或建議方向"
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
                          退回重新修改
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
                            ? "部門長承認並送據點長"
                            : "據點長承認並公開"}
                        </button>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="approval-case-list">
                  {approvalQueue.map((policy) => (
                    <button
                      className="approval-case-row"
                      key={policy.id}
                      onClick={() => setApprovalSelectedId(policy.id)}
                    >
                      <span className="approval-case-order">案件</span>
                      <span className="approval-case-main">
                        <b>{policy.code}</b>
                        <strong>
                          {policy.draft[lang].title || policy.draft.zh.title}
                        </strong>
                        <small>
                          送審：{policy.approval?.submittedAt || "—"}　·　
                          預定發布日：{policy.publishDate || "待設定"}
                        </small>
                      </span>
                      <span className="status draft">
                        {policy.approval?.stage}
                      </span>
                      <span className="approval-case-arrow">›</span>
                    </button>
                  ))}
                </div>
              )
            ) : (
              <div className="empty">目前沒有待您承認的規程。</div>
            )}
          </div>
        </section>
      </main>
    );
  if (view === "audit")
    return (
      <main>
        <aside className="sidebar">
          <div className="brand">
            <span className="brand-mark">人</span>
            <div>
              <strong>人資規程庫</strong>
              <small>HR POLICY CENTER</small>
            </div>
          </div>
          <nav>
            <button className="active">◷ 修改紀錄</button>
            <button onClick={() => setView("library")}>▦ 規程資料庫</button>
          </nav>
        </aside>
        <section className="workspace audit-page">
          <header>
            <div>
              <p className="eyebrow">AUDIT TRAIL</p>
              <h1>修改紀錄</h1>
              <p className="sub">操作人、異動時間、規程與修改前後內容。</p>
            </div>
            <button className="ghost" onClick={() => setView("library")}>
              ← 返回規程庫
            </button>
          </header>
          <div className="audit-list">
            {audit.length ? (
              audit.map((a) => (
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
              <div className="empty">尚未有修改紀錄。</div>
            )}
          </div>
          <section className="version-section audit-version-section">
            <div className="audit-version-head">
              <div>
                <h3>版本紀錄與差異比較</h3>
                <p>選擇規程與任意兩個版本，查看內容差異。</p>
              </div>
              <label>
                規程
                <select
                  value={selected.id}
                  onChange={(e) => {
                    const policy = policies.find(
                      (p) => p.id === +e.target.value,
                    );
                    if (policy) {
                      setSelectedId(policy.id);
                      setCompare([
                        Math.max(0, policy.versions.length - 2),
                        Math.max(0, policy.versions.length - 1),
                      ]);
                    }
                  }}
                >
                  {policies.map((policy) => (
                    <option key={policy.id} value={policy.id}>
                      {policy.code} ·{" "}
                      {policy.draft[lang].title || policy.draft.zh.title}
                    </option>
                  ))}
                </select>
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
                      {r.k === "add" ? "+ " : r.k === "remove" ? "− " : "　"}
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
        </section>
      </main>
    );
  return (
    <main>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">人</span>
          <div>
            <strong>人資規程庫</strong>
            <small>HR POLICY CENTER</small>
          </div>
        </div>
        <nav>
          <button className="active">▦ 規程資料庫</button>
          {isAdmin && (
            <button onClick={() => setView("audit")}>◷ 修改紀錄</button>
          )}
          {(isDepartmentHead || isSiteHead) && (
            <button
              onClick={() => {
                setApprovalSelectedId(null);
                setView("approval");
              }}
            >
              <span className="nav-label">
                ✓ 承認待辦
                {approvalQueue.length > 0 && <i className="pending-dot" />}
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
                  ? "部門長 · 第一關承認"
                  : role === "site_head"
                    ? "據點長 · 最終承認"
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
            <p className="eyebrow">人力資源管理系統</p>
            <h1>人事規程資料庫</h1>
            <p className="sub">
              {isAdmin
                ? "可編輯草稿、發布新版本與管理狀態。"
                : "目前為僅查看模式。"}
            </p>
          </div>
          {isAdmin && (
            <button
              className="primary"
              onClick={() => {
                const p: Policy = {
                  id: Date.now(),
                  code: "",
                  category: "任用管理",
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
              placeholder="搜尋規程名稱或代碼"
            />
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <span className="result-count">共 {list.length} 項</span>
        </div>
        {role !== "employee" && (
          <div className="status-bookmarks" aria-label="依狀態篩選規程">
            {statusOptions.map((status) => (
              <button
                key={status}
                className={statusFilter === status ? "active" : ""}
                onClick={() => setStatusFilter(status)}
              >
                <span>{status}</span>
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
                  <span
                    className={`status ${p.status === "草稿" ? "draft" : ["停用", "停用待更新"].includes(p.status) ? "disabled" : ""}`}
                  >
                    {policyStatusLabel(p)}
                  </span>
                </div>
                <h3>
                  {releasedCopy(p)[lang].title || releasedCopy(p).zh.title}
                </h3>
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
                  <h2>{editing ? "編輯草稿" : displayedCopy[lang].title}</h2>
                  <div className="detail-meta">
                    <span
                      className={`status ${selected.status === "草稿" ? "draft" : ["停用", "停用待更新"].includes(selected.status) ? "disabled" : ""}`}
                    >
                      {selected.status}
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
                    <button className="primary" onClick={submitForApproval}>
                      送交部門長承認
                    </button>
                    <button className="ghost danger" onClick={disable}>
                      停用
                    </button>
                  </div>
                )}
              </div>
              <div className="language-bar">
                <span>顯示語言</span>
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
              </div>
              {editing ? (
                <form onSubmit={saveDraft}>
                  {(draft.versions.length > 0 ||
                    draft.approval?.stage === "已承認待發布") && (
                    <div className="change-type-guide">
                      <b>
                        {draft.changeType === "typo"
                          ? "純錯字修改：送審後也需依序完成承認。"
                          : "修改內容事項：送審後會先停用原公開版本，再依序承認。"}
                      </b>
                      <span>可在下方「變更類型」切換流程。</span>
                    </div>
                  )}
                  <div className="form-grid">
                    <label>
                      規程編號
                      <input
                        required
                        value={draft.code}
                        onChange={(e) =>
                          setDraft({ ...draft, code: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      分類
                      <select
                        value={draft.category}
                        onChange={(e) =>
                          setDraft({ ...draft, category: e.target.value })
                        }
                      >
                        {[
                          "任用管理",
                          "出勤休假",
                          "績效發展",
                          "人才培育",
                          "薪酬福利",
                        ].map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
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
                    {draft.versions.length > 0 ||
                    draft.approval?.stage === "已承認待發布" ? (
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
                          <option value="typo">純錯字修改（需承認）</option>
                        </select>
                      </label>
                    ) : (
                      <label>
                        核准狀態
                        <input value="草稿" readOnly />
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
                    <button className="primary">儲存草稿</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="summary">
                    <b>{lang === "zh" ? "規程摘要" : "規程概要"}</b>
                    <p>{displayedCopy[lang].summary}</p>
                  </div>
                  <div className="policy-structure">
                    {(
                      displayedCopy[lang].chapters ||
                      chaptersFromContent(displayedCopy[lang].content)
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
                  <Tables tables={displayedCopy[lang].tables} />
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
    </main>
  );
}
