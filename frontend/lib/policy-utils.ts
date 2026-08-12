import type { Chapter, Copy, Policy } from "./policy-types";

export const policyCategories = [
  "全社基本", "人事", "IT管理", "總務", "營業管理", "會計管理", "EHS", "進出口管理", "COW", "ISO9001",
];
export const categoryCodePrefixes: Record<string, string> = {
  全社基本: "DHT1", 人事: "DHT2", IT管理: "DHT3", 總務: "DHT3", 營業管理: "DHT4",
  會計管理: "DHT5", EHS: "DHT6", 進出口管理: "DHT7", COW: "DHT10", ISO9001: "DHT99",
};
export const categoryCodePrefix = (category: string) => categoryCodePrefixes[category] || categoryCodePrefixes["全社基本"];
export const policyCode = (category: string, value: string, fallback = "0000") => {
  const digits = value.replace(/\D/g, "").slice(-4) || fallback;
  return `${categoryCodePrefix(category)}-${digits.padStart(4, "0")}`;
};
export const policyCodeSuffix = (value: string) => (value.replace(/\D/g, "").slice(-4) || "0000").padStart(4, "0");
export const emptyCopy = (): Copy => ({ title: "", summary: "", content: "", tables: [], chapters: [] });
export const normalizeTables = (value: unknown): string[][][] => {
  if (!Array.isArray(value) || value.length === 0) return [];
  if (Array.isArray(value[0]) && typeof value[0][0] === "string") return [(value as string[][]).map((row) => Array.isArray(row) ? row.map(String) : [])];
  return value.filter(Array.isArray).map((table) => (table as unknown[]).filter(Array.isArray).map((row) => (row as unknown[]).map(String)));
};
export const chaptersFromContent = (content: string): Chapter[] => {
  const articles = content.split("\n").filter(Boolean).map((text, index) => {
    const match = text.match(/^(第[一二三四五六七八九十\d]+條|第\d+条)[　\s]*(.*)$/);
    return { id: `article-${index + 1}`, title: match?.[1] || `第 ${index + 1} 條`, text: match?.[2] || text };
  });
  return articles.length ? [{ id: "chapter-1", title: "第一章　總則", articles }] : [];
};
export const contentFromChapters = (chapters: Chapter[]) => chapters.flatMap((chapter) => chapter.articles.map((article) => `${article.title}　${article.text}`)).join("\n\n");
export const copy = (title: string, summary: string, content: string, tables: string[][][] = []): Copy => ({ title, summary, content, tables, chapters: chaptersFromContent(content) });
export const normalizeCopy = (value: Partial<Copy>): Copy => ({ title: value.title || "", summary: value.summary || "", content: value.content || "", tables: normalizeTables(value.tables), chapters: value.chapters?.length ? value.chapters : chaptersFromContent(value.content || "") });
export const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
export const nextV = (value: string) => { const [major, minor] = value.split(".").map(Number); return `${major}.${minor + 1}`; };
export const now = () => new Date().toLocaleString("zh-TW");
export const ordinal = (number: number) => ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"][number - 1] || String(number);
export const needsDisabledUpdateStatus = (value: Policy) => {
  const latestVersion = value.versions?.at(-1);
  const hasEditedDraft = !!latestVersion && JSON.stringify(value.draft) !== JSON.stringify(latestVersion.copy);
  return value.status === "停用" && (hasEditedDraft || ["待部門長承認", "待據點長承認"].includes(value.approval?.stage || ""));
};
export const normalizePolicy = (value: Policy): Policy => {
  const category = policyCategories.includes(value.category) ? value.category : "人事";
  return { ...value, category, code: policyCode(category, value.code, String(value.id)), status: needsDisabledUpdateStatus(value) ? "停用待更新" : value.status, attachments: value.attachments || [], relatedPolicies: value.relatedPolicies || [], revisionNote: value.revisionNote || "", publishDate: value.publishDate || "", changeType: value.changeType || "content", approval: value.approval || { stage: "草稿" }, draft: { zh: normalizeCopy(value.draft.zh), ja: normalizeCopy(value.draft.ja) }, versions: (value.versions || []).map((version) => ({ ...version, copy: { zh: normalizeCopy(version.copy.zh), ja: normalizeCopy(version.copy.ja) } })) };
};
export const splitLegacyUpdatePolicies = (values: Policy[]) => {
  let nextId = Math.max(0, ...values.map((policy) => policy.id)) + 1;
  return values.flatMap((policy) => {
    if (policy.status !== "停用待更新" || !policy.versions.length) return [policy];
    const published = { ...policy, status: "發布" as const, draft: clone(policy.versions.at(-1)!.copy), approval: { stage: "草稿" as const }, replacesPolicyId: undefined };
    return [published, { ...policy, id: nextId++, status: "草稿" as const, replacesPolicyId: policy.id }];
  });
};
