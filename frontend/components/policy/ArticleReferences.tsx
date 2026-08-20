import type { Article, PolicyTable } from "../../lib/policy-types";
import { articleImageRefs, articleTableRefs, ordinal } from "../../lib/policy-utils";

type Props = {
  article: Article;
  tables: PolicyTable[];
  images: Array<{ name: string; dataUrl: string; alt?: string }>;
  japanese?: boolean;
};

/** 顯示一條條文所關聯的所有表格與圖片。 */
export function ArticleReferences({ article, tables, images, japanese = false }: Props) {
  const tableNotes = articleTableRefs(article)
    .filter((reference) => tables[reference - 1])
    .map((reference) => japanese ? `表${reference}` : `表格 ${reference}`);
  const imageNotes = articleImageRefs(article)
    .filter((reference) => images[reference - 1])
    .map((reference) => japanese ? `図${reference}` : `圖${ordinal(reference)}`);
  const notes = [...tableNotes, ...imageNotes];
  if (!notes.length) return null;
  return <small className="article-table-note">{japanese ? "注：関連資料は" : "註：相關資料請參照"}{notes.join("、")}</small>;
}
