"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Regulation = {
  id: number;
  title: string;
  category: string;
  code: string;
  version: string;
  effectiveDate: string;
  updatedAt: string;
  status: "現行" | "草稿";
  summary: string;
  content: string;
};

const initialRegulations: Regulation[] = [
  { id: 1, title: "員工聘僱與任用規程", category: "任用管理", code: "HR-001", version: "3.2", effectiveDate: "2025-01-01", updatedAt: "2025-01-06", status: "現行", summary: "規範招募、任用、試用及正式聘僱的作業原則。", content: "第一條　為建立公平、透明之任用制度，特訂定本規程。\n\n第二條　各職缺應依核准編制及職務說明書辦理招募。\n\n第三條　新進人員試用期原則為三個月，期滿由主管完成考核。" },
  { id: 2, title: "出勤與請假管理規程", category: "出勤休假", code: "HR-002", version: "2.8", effectiveDate: "2024-07-01", updatedAt: "2024-06-18", status: "現行", summary: "說明工作時間、打卡、加班、各類假別及申請程序。", content: "第一條　員工應依公司規定時間出勤並完成打卡。\n\n第二條　請假應於系統提出申請，並檢附必要證明文件。\n\n第三條　加班須經主管事前核准，並依相關規定辦理。" },
  { id: 3, title: "績效考核與獎酬規程", category: "績效發展", code: "HR-003", version: "1.9", effectiveDate: "2025-01-01", updatedAt: "2024-12-20", status: "現行", summary: "建立目標設定、績效評估、回饋與獎酬連結原則。", content: "第一條　績效考核以職務目標、能力展現及行為表現為評量基礎。\n\n第二條　年度考核於每年十二月辦理，結果作為薪酬調整及人才發展參考。" },
  { id: 4, title: "員工教育訓練規程", category: "人才培育", code: "HR-004", version: "1.4", effectiveDate: "2024-03-01", updatedAt: "2024-02-15", status: "現行", summary: "規範新進訓練、專業培訓與學習發展資源。", content: "第一條　公司依組織及個人發展需要，規劃年度教育訓練。\n\n第二條　員工參與外訓前，應完成申請與核准程序。" },
  { id: 5, title: "彈性工作與遠距辦公規程", category: "出勤休假", code: "HR-005", version: "0.9", effectiveDate: "", updatedAt: "2025-01-10", status: "草稿", summary: "規範遠距工作資格、申請流程與資訊安全責任。", content: "第一條　本規程適用於經核准採彈性或遠距工作模式之員工。\n\n第二條　申請人應與主管確認工作目標、聯繫時段及資訊安全措施。" },
];

const blankRegulation = (): Regulation => ({ id: Date.now(), title: "", category: "任用管理", code: "", version: "1.0", effectiveDate: "", updatedAt: new Date().toISOString().slice(0, 10), status: "草稿", summary: "", content: "" });

export default function Home() {
  const [regulations, setRegulations] = useState(initialRegulations);
  const [selectedId, setSelectedId] = useState(1);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部分類");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Regulation>(initialRegulations[0]);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("hr-regulations");
    if (saved) {
      const parsed = JSON.parse(saved) as Regulation[];
      setRegulations(parsed);
      if (parsed.length) { setSelectedId(parsed[0].id); setDraft(parsed[0]); }
    }
  }, []);

  const selected = regulations.find((item) => item.id === selectedId) ?? regulations[0];
  const categories = ["全部分類", ...Array.from(new Set(regulations.map((item) => item.category)))];
  const filtered = useMemo(() => regulations.filter((item) => (category === "全部分類" || item.category === category) && `${item.title} ${item.code} ${item.summary}`.toLowerCase().includes(query.toLowerCase())), [regulations, category, query]);

  function openRegulation(item: Regulation) { setSelectedId(item.id); setDraft(item); setEditing(false); }
  function createRegulation() { const next = blankRegulation(); setDraft(next); setSelectedId(next.id); setEditing(true); }
  function save(event: FormEvent) {
    event.preventDefault();
    const updated = { ...draft, updatedAt: new Date().toISOString().slice(0, 10) };
    const exists = regulations.some((item) => item.id === updated.id);
    const next = exists ? regulations.map((item) => item.id === updated.id ? updated : item) : [updated, ...regulations];
    setRegulations(next); setSelectedId(updated.id); setDraft(updated); setEditing(false); localStorage.setItem("hr-regulations", JSON.stringify(next)); setNotice("規程已儲存"); setTimeout(() => setNotice(""), 2400);
  }

  return <main>
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">人</span><div><strong>人資規程庫</strong><small>HR Policy Center</small></div></div>
      <nav><a className="active" href="#library"><span>▦</span> 規程資料庫</a><a href="#about"><span>◷</span> 修訂紀錄</a><a href="#about"><span>⚙</span> 系統設定</a></nav>
      <div className="sidebar-foot"><div className="avatar">王</div><div><b>王小明</b><small>人力資源部</small></div><button aria-label="登出">⌄</button></div>
    </aside>
    <section className="workspace" id="library">
      <header><div><p className="eyebrow">人力資源管理系統</p><h1>人事規程資料庫</h1><p className="sub">集中管理、即時更新，讓每項制度都有清楚依據。</p></div><button className="primary" onClick={createRegulation}>＋ 新增規程</button></header>
      {notice && <div className="notice">✓ {notice}</div>}
      <div className="metrics"><div><span>現行規程</span><b>{regulations.filter(r => r.status === "現行").length}</b><em>項</em></div><div><span>待發布草稿</span><b>{regulations.filter(r => r.status === "草稿").length}</b><em>項</em></div><div><span>本月已更新</span><b>3</b><em>項</em></div></div>
      <div className="toolbar"><label className="search">⌕ <input value={query} onChange={e => setQuery(e.target.value)} placeholder="搜尋規程名稱、編號或關鍵字" /></label><select value={category} onChange={e => setCategory(e.target.value)}>{categories.map(c => <option key={c}>{c}</option>)}</select><span className="result-count">共 {filtered.length} 項</span></div>
      <div className="content-grid">
        <div className="reg-list">{filtered.map(item => <button key={item.id} className={`reg-card ${selectedId === item.id ? "selected" : ""}`} onClick={() => openRegulation(item)}><div className="card-top"><span className="code">{item.code}</span><span className={`status ${item.status === "草稿" ? "draft" : ""}`}>{item.status}</span></div><h3>{item.title}</h3><p>{item.summary}</p><footer><span>{item.category}</span><time>更新於 {item.updatedAt}</time></footer></button>)}{filtered.length === 0 && <div className="empty">找不到符合的規程</div>}</div>
        <article className="detail">{editing ? <form onSubmit={save}><div className="detail-head"><div><p className="eyebrow">{draft.id && regulations.some(r => r.id === draft.id) ? "編輯規程" : "新增規程"}</p><h2>規程內容</h2></div><div className="actions"><button type="button" className="ghost" onClick={() => { setDraft(selected); setEditing(false); }}>取消</button><button className="primary" type="submit">儲存規程</button></div></div><div className="form-grid"><label>規程名稱<input required value={draft.title} onChange={e => setDraft({...draft,title:e.target.value})} /></label><label>規程編號<input required placeholder="例如 HR-006" value={draft.code} onChange={e => setDraft({...draft,code:e.target.value})} /></label><label>分類<select value={draft.category} onChange={e => setDraft({...draft,category:e.target.value})}>{["任用管理","出勤休假","績效發展","人才培育","薪酬福利"].map(x => <option key={x}>{x}</option>)}</select></label><label>版本<input value={draft.version} onChange={e => setDraft({...draft,version:e.target.value})} /></label><label>生效日期<input type="date" value={draft.effectiveDate} onChange={e => setDraft({...draft,effectiveDate:e.target.value})} /></label><label>狀態<select value={draft.status} onChange={e => setDraft({...draft,status:e.target.value as Regulation["status"]})}><option>草稿</option><option>現行</option></select></label></div><label>摘要<textarea rows={2} value={draft.summary} onChange={e => setDraft({...draft,summary:e.target.value})} /></label><label>規程全文<textarea className="policy-editor" rows={12} value={draft.content} onChange={e => setDraft({...draft,content:e.target.value})} /></label></form> : selected && <><div className="detail-head"><div><p className="eyebrow">{selected.category} · {selected.code}</p><h2>{selected.title}</h2><div className="detail-meta"><span className={`status ${selected.status === "草稿" ? "draft" : ""}`}>{selected.status}</span><span>版本 {selected.version}</span><span>生效日 {selected.effectiveDate || "待定"}</span></div></div><button className="edit" onClick={() => { setDraft(selected); setEditing(true); }}>✎ 編輯規程</button></div><div className="summary"><b>規程摘要</b><p>{selected.summary}</p></div><div className="policy-text">{selected.content.split("\n").map((line, i) => <p key={i}>{line || "　"}</p>)}</div><footer className="detail-foot">最後更新：{selected.updatedAt}　·　版本 {selected.version}</footer></>}</article>
      </div>
    </section>
  </main>;
}
