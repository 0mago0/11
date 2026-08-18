import type { Article, Chapter } from "../../lib/policy-types";
import { normalizeTables, ordinal } from "../../lib/policy-utils";

type Props = {
  chapters: Chapter[];
  tables: unknown;
  images?: Array<{ name: string; dataUrl: string; alt?: string }>;
  onChange: (chapters: Chapter[]) => void;
};

/** 編輯規程的固定階層：章可有節或條，節只可有條。 */
export function StructureEditor({ chapters, tables, images = [], onChange }: Props) {
  const safeTables = normalizeTables(tables);
  const replaceChapter = (chapterIndex: number, update: (chapter: Chapter) => Chapter) =>
    onChange(chapters.map((chapter, index) => index === chapterIndex ? update(chapter) : chapter));
  const addChapter = () => onChange([...chapters, { id: String(Date.now()), title: `第${ordinal(chapters.length + 1)}章`, articles: [], sections: [] }]);
  const addChapterArticle = (chapterIndex: number) => replaceChapter(chapterIndex, (chapter) => ({ ...chapter, articles: [...chapter.articles, { id: `${Date.now()}-article`, title: `第${ordinal(chapter.articles.length + 1)}條`, text: "" }] }));
  const addSection = (chapterIndex: number) => replaceChapter(chapterIndex, (chapter) => ({ ...chapter, sections: [...(chapter.sections || []), { id: `${Date.now()}-section`, title: `第${ordinal((chapter.sections || []).length + 1)}節`, articles: [] }] }));
  const updateArticle = (chapterIndex: number, sectionIndex: number | null, articleIndex: number, update: (article: Article) => Article) => replaceChapter(chapterIndex, (chapter) => {
    if (sectionIndex === null) return { ...chapter, articles: chapter.articles.map((article, index) => index === articleIndex ? update(article) : article) };
    return { ...chapter, sections: (chapter.sections || []).map((section, index) => index === sectionIndex ? { ...section, articles: section.articles.map((article, position) => position === articleIndex ? update(article) : article) } : section) };
  });
  const cleanArticles = (chapterIndex: number, sectionIndex: number | null, articleIndex: number) => replaceChapter(chapterIndex, (chapter) => {
    if (sectionIndex === null) return { ...chapter, articles: chapter.articles.filter((_, index) => index !== articleIndex) };
    return { ...chapter, sections: (chapter.sections || []).map((section, index) => index === sectionIndex ? { ...section, articles: section.articles.filter((_, position) => position !== articleIndex) } : section) };
  });
  const updateReference = (chapterIndex: number, sectionIndex: number | null, articleIndex: number, value: string) => {
    const [kind, raw] = value.split(":");
    updateArticle(chapterIndex, sectionIndex, articleIndex, (article) => ({ ...article, tableRef: kind === "table" ? Number(raw) : undefined, imageRef: kind === "image" ? Number(raw) : undefined }));
  };
  const articleEditor = (article: Article, chapterIndex: number, sectionIndex: number | null, articleIndex: number) => <div className="article-editor" key={article.id}>
    <b>{article.title}</b>
    <div className="article-editor-fields">
      <textarea rows={3} value={article.text} placeholder="輸入條文內容" onChange={(event) => updateArticle(chapterIndex, sectionIndex, articleIndex, (current) => ({ ...current, text: event.target.value }))} />
      {article.tableRef && safeTables[article.tableRef - 1] && <small className="article-table-preview">自動註解：相關資料請參照表格 {article.tableRef}</small>}
      {article.imageRef && images[article.imageRef - 1] && <small className="article-table-preview">自動註解：相關資料請參照圖 {ordinal(article.imageRef)}</small>}
    </div>
    <div className="article-editor-actions">
      <button type="button" className="remove-article" onClick={() => cleanArticles(chapterIndex, sectionIndex, articleIndex)}>刪除</button>
      <label className="article-table-select">關聯資料<select value={article.tableRef ? `table:${article.tableRef}` : article.imageRef ? `image:${article.imageRef}` : ""} onChange={(event) => updateReference(chapterIndex, sectionIndex, articleIndex, event.target.value)}><option value="">不設定</option>{safeTables.map((_, index) => <option key={`table-${index}`} value={`table:${index + 1}`}>表格 {index + 1}</option>)}{images.map((image, index) => <option key={`image-${index}`} value={`image:${index + 1}`}>圖 {ordinal(index + 1)}（{image.alt || image.name}）</option>)}</select></label>
    </div>
  </div>;
  return <section className="structure-editor">
    <div className="structure-editor-head"><div><b>章節與條文</b><small>章下面可新增節或條；節下面只能新增條。</small></div><button type="button" className="ghost" onClick={addChapter}>＋ 新增章</button></div>
    {chapters.map((chapter, chapterIndex) => <div className="chapter-editor" key={chapter.id}>
      <div className="chapter-title"><label>章標題<input value={chapter.title} placeholder={`第${ordinal(chapterIndex + 1)}章　輸入標題`} onChange={(event) => replaceChapter(chapterIndex, (current) => ({ ...current, title: event.target.value }))} /></label><button type="button" onClick={() => addSection(chapterIndex)}>＋ 新增節</button><button type="button" onClick={() => addChapterArticle(chapterIndex)}>＋ 新增條</button></div>
      {chapter.articles.map((article, articleIndex) => articleEditor(article, chapterIndex, null, articleIndex))}
      {(chapter.sections || []).map((section, sectionIndex) => <div className="section-editor" key={section.id}>
        <div className="chapter-title"><label>節標題<input value={section.title} placeholder={`第${ordinal(sectionIndex + 1)}節　輸入標題`} onChange={(event) => replaceChapter(chapterIndex, (current) => ({ ...current, sections: (current.sections || []).map((item, index) => index === sectionIndex ? { ...item, title: event.target.value } : item) }))} /></label><button type="button" onClick={() => replaceChapter(chapterIndex, (current) => ({ ...current, sections: (current.sections || []).map((item, index) => index === sectionIndex ? { ...item, articles: [...item.articles, { id: `${Date.now()}-section-article`, title: `第${ordinal(item.articles.length + 1)}條`, text: "" }] } : item) }))}>＋ 新增條</button><button type="button" className="remove-article" onClick={() => replaceChapter(chapterIndex, (current) => ({ ...current, sections: (current.sections || []).filter((_, index) => index !== sectionIndex) }))}>刪除節</button></div>
        {section.articles.map((article, articleIndex) => articleEditor(article, chapterIndex, sectionIndex, articleIndex))}
      </div>)}
    </div>)}
    {!chapters.length && <div className="empty">尚未建立章節。請先新增章，再新增節或條。</div>}
  </section>;
}
