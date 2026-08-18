import type { Chapter, Copy, Policy, PolicyTable, TableMerge } from "./policy-types";

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
export const normalizeTables = (value: unknown): PolicyTable[] => {
  if (!Array.isArray(value) || value.length === 0) return [];
  if (Array.isArray(value[0]) && typeof value[0][0] === "string") return [{ cells: (value as string[][]).map((row) => Array.isArray(row) ? row.map(String) : []) }];
  return value.map((table) => {
    if (Array.isArray(table)) return { cells: table.filter(Array.isArray).map((row) => (row as unknown[]).map(String)) };
    const item = table as { cells?: unknown; merges?: unknown };
    if (!item || !Array.isArray(item.cells)) return null;
    return { cells: item.cells.filter(Array.isArray).map((row) => (row as unknown[]).map(String)), merges: Array.isArray(item.merges) ? item.merges.filter((merge): merge is TableMerge => !!merge && typeof merge === "object" && ["startRow", "startCol", "endRow", "endCol"].every((key) => Number.isInteger((merge as Record<string, unknown>)[key]))) : [] };
  }).filter((table): table is PolicyTable => table !== null);
};
export const chaptersFromContent = (content: string): Chapter[] => {
  const chapterPattern = /^第\s*([一二三四五六七八九十百千\d]+)\s*章[　\s]*(.*)$/;
  const articlePattern = /^第\s*([一二三四五六七八九十百千\d]+)\s*(條|条)[　\s]*(.*)$/;
  const chapters: Chapter[] = [];
  let chapter: Chapter | null = null;
  let article: Chapter["articles"][number] | null = null;
  let id = 0;
  const ensureChapter = () => {
    if (!chapter) { chapter = { id: `chapter-${++id}`, title: "第一章　總則", articles: [] }; chapters.push(chapter); }
    return chapter;
  };
  for (const rawLine of content.replace(/\r/g, "").split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const chapterMatch = line.match(chapterPattern);
    if (chapterMatch) { chapter = { id: `chapter-${++id}`, title: `第${chapterMatch[1]}章${chapterMatch[2] ? `　${chapterMatch[2]}` : ""}`, articles: [] }; chapters.push(chapter); article = null; continue; }
    const articleMatch = line.match(articlePattern);
    if (articleMatch) { article = { id: `article-${++id}`, title: `第${articleMatch[1]}${articleMatch[2]}`, text: articleMatch[3] || "" }; ensureChapter().articles.push(article); continue; }
    if (article) article.text = `${article.text}${article.text ? "\n" : ""}${line}`;
    else { article = { id: `article-${++id}`, title: "前言", text: line }; ensureChapter().articles.push(article); }
  }
  return chapters;
};
export const contentFromChapters = (chapters: Chapter[]) => chapters.map((chapter) => [chapter.title, ...chapter.articles.map((article) => `${article.title}　${article.text}`)].filter(Boolean).join("\n\n")).join("\n\n");
export const copy = (title: string, summary: string, content: string, tables: PolicyTable[] = []): Copy => ({ title, summary, content, tables, chapters: chaptersFromContent(content) });
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
