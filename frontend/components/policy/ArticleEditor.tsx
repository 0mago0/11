import type { Article, PolicyTable } from "../../lib/policy-types";
import { ordinal } from "../../lib/policy-utils";

type Props = {
  article: Article;
  tables: PolicyTable[];
  images: Array<{ name: string; dataUrl: string; alt?: string }>;
  japanese: boolean;
  onUpdate: (update: (article: Article) => Article) => void;
  onRemove: () => void;
};

/** 單一條文的文字輸入與關聯表格／圖片選擇。 */
export function ArticleEditor({
  article,
  tables,
  images,
  japanese,
  onUpdate,
  onRemove,
}: Props) {
  const updateReference = (value: string) => {
    const [kind, raw] = value.split(":");
    onUpdate((current) => ({
      ...current,
      tableRef: kind === "table" ? Number(raw) : undefined,
      imageRef: kind === "image" ? Number(raw) : undefined,
    }));
  };
  const referenceValue = article.tableRef
    ? `table:${article.tableRef}`
    : article.imageRef
      ? `image:${article.imageRef}`
      : "";

  return (
    <div className="article-editor">
      <b>{article.title}</b>
      <div className="article-editor-fields">
        <textarea
          rows={3}
          value={article.text}
          placeholder={japanese ? "条文内容を入力" : "輸入條文內容"}
          onChange={(event) => onUpdate((current) => ({ ...current, text: event.target.value }))}
        />
        {article.tableRef && tables[article.tableRef - 1] && (
          <small className="article-table-preview">
            {japanese ? `自動注記：表${article.tableRef}を参照` : `自動註解：相關資料請參照表格 ${article.tableRef}`}
          </small>
        )}
        {article.imageRef && images[article.imageRef - 1] && (
          <small className="article-table-preview">
            {japanese ? `自動注記：図${article.imageRef}を参照` : `自動註解：相關資料請參照圖 ${ordinal(article.imageRef)}`}
          </small>
        )}
      </div>
      <div className="article-editor-actions">
        <button type="button" className="remove-article" onClick={onRemove}>
          {japanese ? "削除" : "刪除"}
        </button>
        <label className="article-table-select">
          {japanese ? "関連資料" : "關聯資料"}
          <select value={referenceValue} onChange={(event) => updateReference(event.target.value)}>
            <option value="">{japanese ? "設定しない" : "不設定"}</option>
            {tables.map((_, index) => (
              <option key={`table-${index}`} value={`table:${index + 1}`}>
                {japanese ? "表" : "表格 "}{index + 1}
              </option>
            ))}
            {images.map((image, index) => (
              <option key={`image-${index}`} value={`image:${index + 1}`}>
                {japanese ? "図" : "圖 "}{japanese ? index + 1 : ordinal(index + 1)}（{image.alt || image.name}）
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
