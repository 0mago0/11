import type { Article, PolicyTable } from "../../lib/policy-types";
import { articleImageRefs, articleTableRefs, ordinal } from "../../lib/policy-utils";

type Props = {
  article: Article;
  tables: PolicyTable[];
  images: Array<{ name: string; dataUrl: string; alt?: string }>;
  japanese: boolean;
  onUpdate: (update: (article: Article) => Article) => void;
  onRemove: () => void;
};

/** 單一條文的文字輸入與可多選的表格／圖片關聯。 */
export function ArticleEditor({ article, tables, images, japanese, onUpdate, onRemove }: Props) {
  const tableRefs = articleTableRefs(article);
  const imageRefs = articleImageRefs(article);
  const toggleReference = (kind: "table" | "image", reference: number) => onUpdate((current) => {
    const currentRefs = kind === "table" ? articleTableRefs(current) : articleImageRefs(current);
    const nextRefs = currentRefs.includes(reference)
      ? currentRefs.filter((item) => item !== reference)
      : [...currentRefs, reference].sort((left, right) => left - right);
    return kind === "table"
      ? { ...current, tableRefs: nextRefs, tableRef: undefined }
      : { ...current, imageRefs: nextRefs, imageRef: undefined };
  });
  const referenceNotes = [
    ...tableRefs.filter((reference) => tables[reference - 1]).map((reference) => japanese ? `表${reference}` : `表格 ${reference}`),
    ...imageRefs.filter((reference) => images[reference - 1]).map((reference) => japanese ? `図${reference}` : `圖${ordinal(reference)}`),
  ];

  return (
    <div className="article-editor">
      <b>{article.title}</b>
      <div className="article-editor-fields">
        <textarea rows={3} value={article.text} placeholder={japanese ? "条文内容を入力" : "輸入條文內容"} onChange={(event) => onUpdate((current) => ({ ...current, text: event.target.value }))} />
        {!!referenceNotes.length && <small className="article-table-preview">{japanese ? "自動注記：" : "自動註解：相關資料請參照"}{referenceNotes.join("、")}</small>}
      </div>
      <div className="article-editor-actions">
        <button type="button" className="remove-article" onClick={onRemove}>{japanese ? "削除" : "刪除"}</button>
        <fieldset className="article-reference-picker">
          <legend>{japanese ? "関連資料（複数選択可）" : "關聯資料（可多選）"}</legend>
          {[...tables.map((_, index) => ({ kind: "table" as const, reference: index + 1, label: japanese ? `表${index + 1}` : `表格 ${index + 1}`, checked: tableRefs.includes(index + 1) })), ...images.map((_, index) => ({ kind: "image" as const, reference: index + 1, label: japanese ? `図${index + 1}` : `圖${ordinal(index + 1)}`, checked: imageRefs.includes(index + 1) }))].map((item) => (
            <label key={`${item.kind}-${item.reference}`}><input type="checkbox" checked={item.checked} onChange={() => toggleReference(item.kind, item.reference)} />{item.label}</label>
          ))}
          {!tables.length && !images.length && <small>{japanese ? "表・画像がありません。" : "尚未新增表格或圖片。"}</small>}
        </fieldset>
      </div>
    </div>
  );
}
