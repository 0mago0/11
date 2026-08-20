import type { Article, Chapter, Lang } from "../../lib/policy-types";
import { normalizeTables, ordinal } from "../../lib/policy-utils";
import { ArticleEditor } from "./ArticleEditor";

type Props = {
  chapters: Chapter[];
  tables: unknown;
  images?: Array<{ name: string; dataUrl: string; alt?: string }>;
  lang: Lang;
  onChange: (chapters: Chapter[]) => void;
};

/** 依目前編輯語言產生章、節、條標題。 */
const heading = (kind: "章" | "節" | "條", index: number, lang: Lang) => {
  const number = lang === "ja" ? String(index) : ordinal(index);
  const suffix = lang === "ja" && kind === "條" ? "条" : kind;
  return `第${number}${suffix}`;
};

/** 編輯規程的固定階層：章可有節或條，節只可有條。 */
export function StructureEditor({
  chapters,
  tables,
  images = [],
  lang,
  onChange,
}: Props) {
  const safeTables = normalizeTables(tables);
  const japanese = lang === "ja";
  const label = japanese
    ? {
        heading: "章・節・条文",
        help: "章には節または条文を、節には条文を追加できます。",
        addChapter: "＋ 章を追加",
        chapterTitle: "章タイトル",
        sectionTitle: "節タイトル",
        addSection: "＋ 節を追加",
        addArticle: "＋ 条文を追加",
        removeSection: "節を削除",
        enterTitle: "タイトルを入力",
        empty: "章・節・条文がありません。まず章を追加してください。",
      }
    : {
        heading: "章節與條文",
        help: "章下面可新增節或條；節下面只能新增條。",
        addChapter: "＋ 新增章",
        chapterTitle: "章標題",
        sectionTitle: "節標題",
        addSection: "＋ 新增節",
        addArticle: "＋ 新增條",
        removeSection: "刪除節",
        enterTitle: "輸入標題",
        empty: "尚未建立章節。請先新增章，再新增節或條。",
      };

  const replaceChapter = (
    chapterIndex: number,
    update: (chapter: Chapter) => Chapter,
  ) => onChange(chapters.map((chapter, index) =>
    index === chapterIndex ? update(chapter) : chapter,
  ));

  const addChapter = () => onChange([
    ...chapters,
    { id: String(Date.now()), title: heading("章", chapters.length + 1, lang), articles: [], sections: [] },
  ]);

  const addChapterArticle = (chapterIndex: number) => replaceChapter(
    chapterIndex,
    (chapter) => ({
      ...chapter,
      articles: [
        ...chapter.articles,
        { id: `${Date.now()}-article`, title: heading("條", chapter.articles.length + 1, lang), text: "" },
      ],
    }),
  );

  const addSection = (chapterIndex: number) => replaceChapter(
    chapterIndex,
    (chapter) => ({
      ...chapter,
      sections: [
        ...(chapter.sections || []),
        {
          id: `${Date.now()}-section`,
          title: heading("節", (chapter.sections || []).length + 1, lang),
          articles: [],
        },
      ],
    }),
  );

  const addSectionArticle = (chapterIndex: number, sectionIndex: number) =>
    replaceChapter(chapterIndex, (chapter) => ({
      ...chapter,
      sections: (chapter.sections || []).map((section, index) =>
        index === sectionIndex
          ? {
              ...section,
              articles: [
                ...section.articles,
                { id: `${Date.now()}-section-article`, title: heading("條", section.articles.length + 1, lang), text: "" },
              ],
            }
          : section,
      ),
    }));

  const updateArticle = (
    chapterIndex: number,
    sectionIndex: number | null,
    articleIndex: number,
    update: (article: Article) => Article,
  ) => replaceChapter(chapterIndex, (chapter) => {
    if (sectionIndex === null) {
      return {
        ...chapter,
        articles: chapter.articles.map((article, index) =>
          index === articleIndex ? update(article) : article,
        ),
      };
    }
    return {
      ...chapter,
      sections: (chapter.sections || []).map((section, index) =>
        index === sectionIndex
          ? {
              ...section,
              articles: section.articles.map((article, position) =>
                position === articleIndex ? update(article) : article,
              ),
            }
          : section,
      ),
    };
  });

  const removeArticle = (chapterIndex: number, sectionIndex: number | null, articleIndex: number) =>
    replaceChapter(chapterIndex, (chapter) => {
      if (sectionIndex === null) {
        return { ...chapter, articles: chapter.articles.filter((_, index) => index !== articleIndex) };
      }
      return {
        ...chapter,
        sections: (chapter.sections || []).map((section, index) =>
          index === sectionIndex
            ? { ...section, articles: section.articles.filter((_, position) => position !== articleIndex) }
            : section,
        ),
      };
    });

  const renderArticle = (
    article: Article,
    chapterIndex: number,
    sectionIndex: number | null,
    articleIndex: number,
  ) => (
    <ArticleEditor
      key={article.id}
      article={article}
      tables={safeTables}
      images={images}
      japanese={japanese}
      onUpdate={(update) => updateArticle(chapterIndex, sectionIndex, articleIndex, update)}
      onRemove={() => removeArticle(chapterIndex, sectionIndex, articleIndex)}
    />
  );

  return (
    <section className="structure-editor">
      <div className="structure-editor-head">
        <div><b>{label.heading}</b><small>{label.help}</small></div>
        <button type="button" className="ghost" onClick={addChapter}>{label.addChapter}</button>
      </div>
      {chapters.map((chapter, chapterIndex) => (
        <div className="chapter-editor" key={chapter.id}>
          <div className="chapter-title">
            <label>{label.chapterTitle}<input value={chapter.title} placeholder={`${heading("章", chapterIndex + 1, lang)}　${label.enterTitle}`} onChange={(event) => replaceChapter(chapterIndex, (current) => ({ ...current, title: event.target.value }))} /></label>
            <button type="button" onClick={() => addSection(chapterIndex)}>{label.addSection}</button>
            <button type="button" onClick={() => addChapterArticle(chapterIndex)}>{label.addArticle}</button>
          </div>
          {chapter.articles.map((article, articleIndex) => renderArticle(article, chapterIndex, null, articleIndex))}
          {(chapter.sections || []).map((section, sectionIndex) => (
            <div className="section-editor" key={section.id}>
              <div className="chapter-title">
                <label>{label.sectionTitle}<input value={section.title} placeholder={`${heading("節", sectionIndex + 1, lang)}　${label.enterTitle}`} onChange={(event) => replaceChapter(chapterIndex, (current) => ({ ...current, sections: (current.sections || []).map((item, index) => index === sectionIndex ? { ...item, title: event.target.value } : item) }))} /></label>
                <button type="button" onClick={() => addSectionArticle(chapterIndex, sectionIndex)}>{label.addArticle}</button>
                <button type="button" className="remove-article" onClick={() => replaceChapter(chapterIndex, (current) => ({ ...current, sections: (current.sections || []).filter((_, index) => index !== sectionIndex) }))}>{label.removeSection}</button>
              </div>
              {section.articles.map((article, articleIndex) => renderArticle(article, chapterIndex, sectionIndex, articleIndex))}
            </div>
          ))}
        </div>
      ))}
      {!chapters.length && <div className="empty">{label.empty}</div>}
    </section>
  );
}
