import { a as require_react, o as __toESM, t as require_jsx_runtime } from "../index.js";
//#region app/page.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
var policyCategories = [
	"全社基本",
	"人事",
	"IT管理",
	"總務",
	"營業管理",
	"會計管理",
	"EHS",
	"進出口管理",
	"COW",
	"ISO9001"
];
var categoryCodePrefixes = {
	全社基本: "DHT1",
	人事: "DHT2",
	IT管理: "DHT3",
	總務: "DHT3",
	營業管理: "DHT4",
	會計管理: "DHT5",
	EHS: "DHT6",
	進出口管理: "DHT7",
	COW: "DHT10",
	ISO9001: "DHT99"
};
var categoryCodePrefix = (category) => categoryCodePrefixes[category] || categoryCodePrefixes["全社基本"];
var policyCode = (category, value, fallback = "0000") => {
	const digits = value.replace(/\D/g, "").slice(-4) || fallback;
	return `${categoryCodePrefix(category)}-${digits.padStart(4, "0")}`;
};
var policyCodeSuffix = (value) => (value.replace(/\D/g, "").slice(-4) || "0000").padStart(4, "0");
var emptyCopy = () => ({
	title: "",
	summary: "",
	content: "",
	tables: [],
	chapters: []
});
var chaptersFromContent = (content) => {
	const articles = content.split("\n").filter(Boolean).map((text, index) => {
		const match = text.match(/^(第[一二三四五六七八九十\d]+條|第\d+条)[　\s]*(.*)$/);
		return {
			id: `article-${index + 1}`,
			title: match?.[1] || `第 ${index + 1} 條`,
			text: match?.[2] || text
		};
	});
	return articles.length ? [{
		id: "chapter-1",
		title: "第一章　總則",
		articles
	}] : [];
};
var copy = (title, summary, content, tables = []) => ({
	title,
	summary,
	content,
	tables,
	chapters: chaptersFromContent(content)
});
var normalizeCopy = (value) => ({
	title: value.title || "",
	summary: value.summary || "",
	content: value.content || "",
	tables: normalizeTables(value.tables),
	chapters: value.chapters?.length ? value.chapters : chaptersFromContent(value.content || "")
});
var needsDisabledUpdateStatus = (value) => {
	const latestVersion = value.versions?.at(-1);
	const hasEditedDraft = !!latestVersion && JSON.stringify(value.draft) !== JSON.stringify(latestVersion.copy);
	const awaitingApproval = ["待部門長承認", "待據點長承認"].includes(value.approval?.stage || "");
	return value.status === "停用" && (hasEditedDraft || awaitingApproval);
};
var normalizePolicy = (value) => {
	const category = policyCategories.includes(value.category) ? value.category : "人事";
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
			ja: normalizeCopy(value.draft.ja)
		},
		versions: (value.versions || []).map((version) => ({
			...version,
			copy: {
				zh: normalizeCopy(version.copy.zh),
				ja: normalizeCopy(version.copy.ja)
			}
		}))
	};
};
var splitLegacyUpdatePolicies = (values) => {
	let nextId = Math.max(0, ...values.map((policy) => policy.id)) + 1;
	return values.flatMap((policy) => {
		if (policy.status !== "停用待更新" || !policy.versions.length) return [policy];
		return [{
			...policy,
			status: "發布",
			draft: clone(policy.versions.at(-1).copy),
			approval: { stage: "草稿" },
			replacesPolicyId: void 0
		}, {
			...policy,
			id: nextId++,
			status: "草稿",
			replacesPolicyId: policy.id
		}];
	});
};
var ordinal = (number) => [
	"一",
	"二",
	"三",
	"四",
	"五",
	"六",
	"七",
	"八",
	"九",
	"十"
][number - 1] || String(number);
var contentFromChapters = (chapters) => chapters.flatMap((chapter) => chapter.articles.map((article) => `${article.title}　${article.text}`)).join("\n\n");
var samplePolicy = (id, code, category, zhTitle, jaTitle, zhSummary, jaSummary, zhContent, jaContent) => ({
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
		ja: copy(jaTitle, jaSummary, jaContent)
	},
	versions: [{
		id: `sample-${id}`,
		number: "1.0",
		publishedAt: "2025-04-01",
		copy: {
			zh: copy(zhTitle, zhSummary, zhContent),
			ja: copy(jaTitle, jaSummary, jaContent)
		},
		revisionNote: "示範規程首次發布"
	}]
});
var categoryDemoPolicies = [
	samplePolicy(101, "COR-001", "全社基本", "文件與規程管理辦法", "文書・規程管理規程", "規範全公司文件的制定、審核、發布與保存方式。", "全社文書の制定、承認、公開および保管方法を定めます。", "第一條　公司規程應依權責完成審核後始得發布。\n\n第二條　各單位應使用最新發布版本辦理作業。", "第1条　会社規程は、権限に基づく承認後に公開する。\n\n第2条　各部門は最新の公開版を使用して業務を行う。"),
	samplePolicy(102, "IT-001", "IT管理", "資訊安全與帳號管理規程", "情報セキュリティ・アカウント管理規程", "規範資訊系統帳號申請、權限管理及資安事件通報。", "情報システムのアカウント申請、権限管理および事故報告を定めます。", "第一條　系統帳號應依職務需求申請，禁止共用帳號。\n\n第二條　發現資安事件時應立即通報資訊單位。", "第1条　システムアカウントは職務上の必要により申請し、共有してはならない。\n\n第2条　セキュリティ事故を発見した場合は直ちに情報部門へ連絡する。"),
	samplePolicy(103, "GA-001", "總務", "辦公環境與資產管理規程", "オフィス環境・資産管理規程", "規範辦公設備、門禁、訪客及公司資產的管理原則。", "事務所設備、入退室、来訪者および会社資産の管理原則を定めます。", "第一條　公司資產應登錄管理並由使用人妥善保管。\n\n第二條　訪客進入辦公區前應完成登記。", "第1条　会社資産は台帳に登録し、使用者が適切に管理する。\n\n第2条　来訪者はオフィスエリアへの入室前に受付登録を行う。"),
	samplePolicy(104, "SAL-001", "營業管理", "客戶報價與訂單管理規程", "見積・受注管理規程", "規範客戶報價、訂單確認及銷售資訊登錄流程。", "顧客見積、受注確認および販売情報登録の手順を定めます。", "第一條　對外報價應使用核准的價格與條件。\n\n第二條　訂單確認後應於系統完成登錄。", "第1条　対外見積は承認済みの価格および条件を使用する。\n\n第2条　受注確定後はシステムへ登録する。"),
	samplePolicy(105, "ACC-001", "會計管理", "費用報支與付款管理規程", "経費精算・支払管理規程", "規範費用申請、憑證保存、核准與付款作業。", "経費申請、証憑保管、承認および支払業務を定めます。", "第一條　費用報支應檢附合法憑證並依核准權限辦理。\n\n第二條　付款資料應經覆核後執行。", "第1条　経費精算には適法な証憑を添付し、承認権限に従う。\n\n第2条　支払情報は照合後に実行する。"),
	samplePolicy(106, "EHS-001", "EHS", "環境安全衛生管理規程", "環境・安全衛生管理規程", "規範職場安全、健康管理與緊急事故應變要求。", "職場安全、健康管理および緊急時対応の要求事項を定めます。", "第一條　員工應遵守職場安全規範並使用必要防護具。\n\n第二條　事故或異常狀況應立即通報。", "第1条　従業員は安全規則を守り、必要な保護具を使用する。\n\n第2条　事故または異常を直ちに報告する。"),
	samplePolicy(107, "IMP-001", "進出口管理", "進出口文件與合規管理規程", "輸出入書類・コンプライアンス管理規程", "規範進出口申報文件、貨品分類及法規遵循。", "輸出入申告書類、品目分類および法令遵守を定めます。", "第一條　進出口申報資料應正確、完整並依規定保存。\n\n第二條　受管制貨品應於出貨前完成確認。", "第1条　輸出入申告資料は正確かつ完全に作成し、規定に従い保管する。\n\n第2条　規制対象品は出荷前に確認を完了する。"),
	samplePolicy(108, "COW-001", "COW", "COW 協作作業管理規程", "COW 協働作業管理規程", "規範跨部門協作任務的指派、追蹤與結案方式。", "部門横断の協働タスクにおける割当、進捗管理および完了方法を定めます。", "第一條　跨部門任務應明確指定負責人與完成期限。\n\n第二條　任務進度應定期更新並保留紀錄。", "第1条　部門横断タスクには責任者と期限を明確に設定する。\n\n第2条　進捗は定期的に更新し、記録を残す。"),
	samplePolicy(109, "ISO-001", "ISO9001", "ISO 9001 品質管理規程", "ISO 9001 品質マネジメント規程", "規範品質目標、內部稽核、不符合事項與持續改善流程。", "品質目標、内部監査、不適合事項および継続的改善の手順を定めます。", "第一條　各單位應依品質目標執行並定期檢討成效。\n\n第二條　發現不符合事項時應採取矯正措施。", "第1条　各部門は品質目標に従って実行し、定期的に有効性を確認する。\n\n第2条　不適合を発見した場合は是正措置を実施する。")
];
var approvalSamplePolicy = (id, code, category, stage, zhTitle, jaTitle, originalZh, revisedZh, originalJa, revisedJa, revisionNote) => ({
	id,
	code: policyCode(category, code, String(id)),
	category,
	effectiveDate: "2026-10-01",
	publishDate: "2026-10-01",
	status: "草稿",
	changeType: "content",
	revisionNote,
	approval: {
		stage,
		submittedAt: "2026/08/12 下午 2:30:00"
	},
	draft: {
		zh: copy(zhTitle, "此為承認流程示範案件，請確認修訂內容。", revisedZh),
		ja: copy(jaTitle, "承認フローのサンプル案件です。改訂内容をご確認ください。", revisedJa)
	},
	versions: [{
		id: `approval-${id}`,
		number: "1.0",
		publishedAt: "2026-04-01",
		copy: {
			zh: copy(zhTitle, "此為原已發布版本。", originalZh),
			ja: copy(jaTitle, "前回公開版です。", originalJa)
		},
		revisionNote: "首次發布"
	}]
});
var approvalDemoPolicies = [
	approvalSamplePolicy(201, "DHT3-0002", "IT管理", "待部門長承認", "資訊安全與帳號管理規程", "情報セキュリティ・アカウント管理規程", "第一條　系統帳號應依職務需求申請，禁止共用帳號。\n\n第二條　發現資安事件時應立即通報資訊單位。", "第一條　系統帳號應依職務需求申請，禁止共用帳號。\n\n第二條　發現資安事件時應於一小時內通報資訊單位。\n\n第三條　離職人員帳號應於最後工作日完成停用。", "第1条　システムアカウントは職務上の必要により申請し、共有してはならない。\n\n第2条　セキュリティ事故を発見した場合は直ちに情報部門へ連絡する。", "第1条　システムアカウントは職務上の必要により申請し、共有してはならない。\n\n第2条　セキュリティ事故は1時間以内に情報部門へ連絡する。\n\n第3条　退職者のアカウントは最終勤務日までに停止する。", "資安通報時限與離職帳號停用流程更新。"),
	approvalSamplePolicy(202, "DHT6-0002", "EHS", "待部門長承認", "環境安全衛生管理規程", "環境・安全衛生管理規程", "第一條　員工應遵守職場安全規範並使用必要防護具。\n\n第二條　事故或異常狀況應立即通報。", "第一條　員工應遵守職場安全規範並使用必要防護具。\n\n第二條　事故或異常狀況應立即通報。\n\n第三條　高風險作業前應完成安全確認表。", "第1条　従業員は安全規則を守り、必要な保護具を使用する。\n\n第2条　事故または異常を直ちに報告する。", "第1条　従業員は安全規則を守り、必要な保護具を使用する。\n\n第2条　事故または異常を直ちに報告する。\n\n第3条　高リスク作業前に安全確認表を完了する。", "高風險作業的事前安全確認要求新增。"),
	approvalSamplePolicy(203, "DHT5-0002", "會計管理", "待據點長承認", "費用報支與付款管理規程", "経費精算・支払管理規程", "第一條　費用報支應檢附合法憑證並依核准權限辦理。\n\n第二條　付款資料應經覆核後執行。", "第一條　費用報支應檢附合法憑證並依核准權限辦理。\n\n第二條　付款資料應經覆核後執行。\n\n第三條　超過十萬元之付款應由財務主管再次確認。", "第1条　経費精算には適法な証憑を添付し、承認権限に従う。\n\n第2条　支払情報は照合後に実行する。", "第1条　経費精算には適法な証憑を添付し、承認権限に従う。\n\n第2条　支払情報は照合後に実行する。\n\n第3条　10万元を超える支払は財務責任者が再確認する。", "高額付款的複核權限調整。")
];
var demoPolicies = [...categoryDemoPolicies, ...approvalDemoPolicies];
var initial = [
	{
		id: 1,
		code: "DHT2-0001",
		category: "人事",
		effectiveDate: "2025-01-01",
		status: "發布",
		changeType: "content",
		draft: {
			zh: copy("員工聘僱與任用規程", "規範招募、任用、試用及正式聘僱的作業原則。", "第一條　為建立公平、透明之任用制度，特訂定本規程。\n\n第二條　各職缺應依核准編制及職務說明書辦理招募。", [[
				"項目",
				"說明",
				"負責單位"
			], [
				"招募",
				"依職務說明書辦理",
				"人力資源部"
			]]),
			ja: copy("雇用・任用規程", "採用、任用、試用及び正式雇用に関する基本原則を定めます。", "第1条　公正で透明な任用制度を確立するため、本規程を定める。\n\n第2条　各求人は承認された人員計画および職務記述書に基づき採用する。", [[
				"項目",
				"内容",
				"担当部署"
			], [
				"採用",
				"職務記述書に基づき実施",
				"人事部"
			]])
		},
		versions: [{
			id: "1",
			number: "3.2",
			publishedAt: "2025-01-06",
			copy: {
				zh: copy("員工聘僱與任用規程", "規範招募、任用、試用及正式聘僱的作業原則。", "第一條　為建立公平、透明之任用制度，特訂定本規程。\n\n第二條　各職缺應依核准編制及職務說明書辦理招募。", [[
					"項目",
					"說明",
					"負責單位"
				], [
					"招募",
					"依職務說明書辦理",
					"人力資源部"
				]]),
				ja: copy("雇用・任用規程", "採用、任用、試用及び正式雇用に関する基本原則を定めます。", "第1条　公正で透明な任用制度を確立するため、本規程を定める。\n\n第2条　各求人は承認された人員計画および職務記述書に基づき採用する。", [[
					"項目",
					"内容",
					"担当部署"
				], [
					"採用",
					"職務記述書に基づき実施",
					"人事部"
				]])
			}
		}]
	},
	{
		id: 2,
		code: "DHT2-0002",
		category: "人事",
		effectiveDate: "2024-07-01",
		status: "發布",
		changeType: "content",
		draft: {
			zh: copy("出勤與請假管理規程", "說明工作時間、打卡、加班、各類假別及申請程序。", "第一條　員工應依公司規定時間出勤並完成打卡。\n\n第二條　請假應於系統提出申請。"),
			ja: copy("勤怠・休暇管理規程", "勤務時間、勤怠記録、残業、休暇および申請手続を定めます。", "第1条　従業員は会社の定める時間に出勤し、勤怠記録を行う。\n\n第2条　休暇はシステムで申請する。")
		},
		versions: [{
			id: "2",
			number: "2.8",
			publishedAt: "2024-06-18",
			copy: {
				zh: copy("出勤與請假管理規程", "說明工作時間、打卡、加班、各類假別及申請程序。", "第一條　員工應依公司規定時間出勤並完成打卡。\n\n第二條　請假應於系統提出申請。"),
				ja: copy("勤怠・休暇管理規程", "勤務時間、勤怠記録、残業、休暇および申請手続を定めます。", "第1条　従業員は会社の定める時間に出勤し、勤怠記録を行う。\n\n第2条　休暇はシステムで申請する。")
			}
		}]
	},
	...demoPolicies
];
var clone = (x) => JSON.parse(JSON.stringify(x));
var nextV = (v) => {
	const [a, b] = v.split(".").map(Number);
	return `${a}.${b + 1}`;
};
var now = () => (/* @__PURE__ */ new Date()).toLocaleString("zh-TW");
var normalizeTables = (value) => {
	if (!Array.isArray(value) || value.length === 0) return [];
	if (Array.isArray(value[0]) && typeof value[0][0] === "string") return [value.map((row) => Array.isArray(row) ? row.map((cell) => String(cell)) : [])];
	return value.filter(Array.isArray).map((table) => table.filter(Array.isArray).map((row) => row.map((cell) => String(cell))));
};
function Tables({ tables, editing, onChange }) {
	const safeTables = normalizeTables(tables);
	const change = (i, r, c, value) => onChange?.(safeTables.map((t, ti) => ti === i ? t.map((row, ri) => ri === r ? row.map((cell, ci) => ci === c ? value : cell) : row) : t));
	const addTable = () => onChange?.([...safeTables, [[
		"欄位 1",
		"欄位 2",
		"欄位 3"
	], [
		"",
		"",
		""
	]]]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "policy-tables",
		children: [safeTables.map((t, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "policy-table",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "table-caption",
					children: ["表格 ", i + 1]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("table", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: t.map((row, r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: row.map((cell, col) => editing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					value: cell,
					onChange: (e) => change(i, r, col, e.target.value),
					placeholder: r === 0 ? "欄位名稱" : "輸入文字"
				}) }, col) : r === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: cell }, col) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: cell }, col)) }, r)) }) }),
				editing && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "table-tools",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => onChange?.(safeTables.map((x, ti) => ti === i ? [...x, Array(x[0]?.length || 3).fill("")] : x)),
							children: "＋ 列"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => onChange?.(safeTables.map((x, ti) => ti === i ? x.map((row) => [...row, ""]) : x)),
							children: "＋ 欄"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => onChange?.(safeTables.filter((_, ti) => ti !== i)),
							children: "刪除表格"
						})
					]
				})
			]
		}, i)), editing && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: "ghost",
			onClick: addTable,
			children: "＋ 新增表格"
		})]
	});
}
function StructureEditor({ chapters, onChange }) {
	const addChapter = () => onChange([...chapters, {
		id: String(Date.now()),
		title: `第${ordinal(chapters.length + 1)}章`,
		articles: []
	}]);
	const addArticle = (chapterIndex) => onChange(chapters.map((chapter, index) => index !== chapterIndex ? chapter : {
		...chapter,
		articles: [...chapter.articles, {
			id: `${Date.now()}-${chapterIndex}`,
			title: `第${ordinal(chapter.articles.length + 1)}條`,
			text: ""
		}]
	}));
	const updateText = (chapterIndex, articleIndex, text) => onChange(chapters.map((chapter, index) => index !== chapterIndex ? chapter : {
		...chapter,
		articles: chapter.articles.map((article, articlePosition) => articlePosition === articleIndex ? {
			...article,
			text
		} : article)
	}));
	const removeArticle = (chapterIndex, articleIndex) => onChange(chapters.map((chapter, index) => index !== chapterIndex ? chapter : {
		...chapter,
		articles: chapter.articles.filter((_, position) => position !== articleIndex)
	}));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "structure-editor",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "structure-editor-head",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "章節與條文" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "使用新增建立章節與條號；僅輸入條文內容。" })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "ghost",
					onClick: addChapter,
					children: "＋ 新增章節"
				})]
			}),
			chapters.map((chapter, chapterIndex) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "chapter-editor",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "chapter-title",
					children: [chapter.title, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => addArticle(chapterIndex),
						children: "＋ 新增條文"
					})]
				}), chapter.articles.map((article, articleIndex) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "article-editor",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: article.title }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
							rows: 3,
							value: article.text,
							placeholder: "輸入條文內容",
							onChange: (event) => updateText(chapterIndex, articleIndex, event.target.value)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "remove-article",
							onClick: () => removeArticle(chapterIndex, articleIndex),
							children: "刪除"
						})
					]
				}, article.id))]
			}, chapter.id)),
			!chapters.length && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "empty",
				children: "尚未建立條文。請先新增章節，再新增條文。"
			})
		]
	});
}
function Home() {
	const [policies, setPolicies] = (0, import_react.useState)(initial), [selectedId, setSelectedId] = (0, import_react.useState)(1), [lang, setLang] = (0, import_react.useState)("zh"), [role, setRole] = (0, import_react.useState)("employee"), [name, setName] = (0, import_react.useState)("Employee"), [view, setView] = (0, import_react.useState)("library"), [editing, setEditing] = (0, import_react.useState)(false), [draft, setDraft] = (0, import_react.useState)(clone(initial[0])), [search, setSearch] = (0, import_react.useState)(""), [auditSearch, setAuditSearch] = (0, import_react.useState)(""), [auditActionFilter, setAuditActionFilter] = (0, import_react.useState)("全部"), [category, setCategory] = (0, import_react.useState)("全部規程"), [statusFilter, setStatusFilter] = (0, import_react.useState)("全部"), [sortMode, setSortMode] = (0, import_react.useState)("status"), [notice, setNotice] = (0, import_react.useState)(""), [audit, setAudit] = (0, import_react.useState)([]), [returnComments, setReturnComments] = (0, import_react.useState)({}), [approvalSelectedId, setApprovalSelectedId] = (0, import_react.useState)(null), [auditPolicyId, setAuditPolicyId] = (0, import_react.useState)(null), [compare, setCompare] = (0, import_react.useState)([0, 0]);
	(0, import_react.useEffect)(() => {
		try {
			const s = localStorage.getItem("hr-policy-v8");
			if (s) {
				const d = JSON.parse(s);
				const normalized = splitLegacyUpdatePolicies(d.policies.map(normalizePolicy));
				const codeMap = Object.fromEntries(d.policies.map((policy, index) => [policy.code, normalized[index]?.code || policy.code]));
				const normalizedAudit = (d.audit || []).map((entry) => ({
					...entry,
					code: codeMap[entry.code] || entry.code
				}));
				const existingCodes = new Set(normalized.map((policy) => policy.code));
				const hydrated = [...normalized, ...demoPolicies.filter((policy) => !existingCodes.has(policy.code))];
				setPolicies(hydrated);
				setAudit(normalizedAudit);
				setSelectedId(hydrated[0]?.id || 1);
				setDraft(clone(hydrated[0] || initial[0]));
				localStorage.setItem("hr-policy-v8", JSON.stringify({
					policies: hydrated,
					audit: normalizedAudit
				}));
			}
			const preview = localStorage.getItem("hr-policy-role-preview");
			if ([
				"admin",
				"employee",
				"department_head",
				"site_head"
			].includes(preview || "")) {
				setRole(preview);
				setLang(preview === "department_head" || preview === "site_head" ? "ja" : "zh");
				setName(preview === "admin" ? "Admin preview" : preview === "department_head" ? "部門長 preview" : preview === "site_head" ? "據點長 preview" : "Employee preview");
				return;
			}
		} catch {}
		fetch("/api/me").then((r) => r.ok ? r.json() : null).then((x) => {
			if (x) {
				setRole(x.role);
				setLang(x.role === "department_head" || x.role === "site_head" ? "ja" : "zh");
				setName(x.name);
			}
		}).catch(() => {});
	}, []);
	(0, import_react.useEffect)(() => {
		if (!notice) return;
		const timer = window.setTimeout(() => setNotice(""), 2e3);
		return () => window.clearTimeout(timer);
	}, [notice]);
	const saveStore = (next, nextAudit = audit) => {
		setPolicies(next);
		setAudit(nextAudit);
		localStorage.setItem("hr-policy-v8", JSON.stringify({
			policies: next,
			audit: nextAudit
		}));
	};
	const isAdmin = role === "admin";
	const isDepartmentHead = role === "department_head";
	const isSiteHead = role === "site_head";
	const isApprover = isDepartmentHead || isSiteHead;
	const ui = (zh, ja) => isApprover ? ja : zh;
	const statusName = (status) => isApprover ? {
		全部: "すべて",
		草稿: "下書き",
		待部門長承認: "部門長承認待ち",
		待據點長承認: "拠点長承認待ち",
		退回修改: "差戻し・修正待ち",
		已承認待發布: "承認済み・公開待ち",
		規程內容更新版本: "規程内容更新版",
		發布: "公開中",
		停用: "停止中"
	}[status] || status : status;
	const visiblePolicies = role === "employee" ? policies.filter((policy) => policy.status === "發布") : policies;
	const hasNoEmployeePolicies = role === "employee" && visiblePolicies.length === 0;
	const selected = (editing && !policies.some((policy) => policy.id === draft.id) ? draft : visiblePolicies.find((x) => x.id === selectedId)) || visiblePolicies[0] || draft;
	const versions = selected.versions;
	const releasedCopy = (policy) => policy.versions.at(-1)?.copy || policy.draft;
	const policyCopy = (policy) => policy.replacesPolicyId ? policy.draft : releasedCopy(policy);
	const hasSavedDraft = (policy) => policy.versions.length > 0 && JSON.stringify(policy.draft) !== JSON.stringify(releasedCopy(policy));
	const displayedCopy = policyCopy(selected);
	const selectedDisplayLang = isApprover && !(displayedCopy.ja.title || displayedCopy.ja.summary || displayedCopy.ja.content) ? "zh" : lang;
	const isApprovalLocked = ["待部門長承認", "待據點長承認"].includes(selected.approval?.stage || "");
	const canChooseChangeType = !selected.replacesPolicyId && selected.status !== "停用" && selected.approval?.stage !== "退回修改" && (selected.versions.length > 0 || selected.approval?.stage === "已承認待發布");
	const reviewLanguage = (policy) => policy.draft.ja.title || policy.draft.ja.summary || policy.draft.ja.content ? "ja" : "zh";
	const policyStatusLabel = (policy) => {
		if (role === "employee") return "發布";
		if (policy.status === "停用待更新") return "停用";
		if (policy.changeType === "content" && policy.status === "停用") return "停用";
		return policy.approval?.stage && policy.approval.stage !== "草稿" ? policy.approval.stage : policy.status;
	};
	const matchesPolicyStatus = (policy, status) => status === "規程內容更新版本" && Boolean(policy.replacesPolicyId) || policyStatusLabel(policy) === status || Boolean(policy.replacesPolicyId) && policy.approval?.stage === status;
	const visibleStatusOptions = isApprover ? [
		"全部",
		"發布",
		"已承認待發布"
	] : [
		"全部",
		"草稿",
		"待部門長承認",
		"待據點長承認",
		"退回修改",
		"已承認待發布",
		"規程內容更新版本",
		"發布",
		"停用"
	];
	const statusCounts = Object.fromEntries(visibleStatusOptions.map((status) => [status, status === "全部" ? visiblePolicies.length : visiblePolicies.filter((policy) => matchesPolicyStatus(policy, status)).length]));
	const changePreviewRole = (next) => {
		localStorage.setItem("hr-policy-role-preview", next);
		setRole(next);
		setLang(next === "department_head" || next === "site_head" ? "ja" : "zh");
		setName(next === "admin" ? "Admin preview" : next === "department_head" ? "部門長 preview" : next === "site_head" ? "據點長 preview" : "Employee preview");
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
		"停用"
	];
	const lastUpdateIndex = (policy) => {
		const index = audit.findIndex((entry) => entry.code === policy.code);
		return index === -1 ? Number.MAX_SAFE_INTEGER : index;
	};
	const list = (0, import_react.useMemo)(() => [...visiblePolicies].filter((p) => (category === "全部規程" || p.category === category) && (role === "employee" || statusFilter === "全部" || matchesPolicyStatus(p, statusFilter)) && `${p.code} ${policyCopy(p).zh.title} ${policyCopy(p).zh.content} ${policyCopy(p).ja.title} ${policyCopy(p).ja.content} ${p.draft.zh.title} ${p.draft.zh.content} ${p.draft.ja.title} ${p.draft.ja.content}`.toLowerCase().includes(search.toLowerCase())).sort((left, right) => sortMode === "updated" ? lastUpdateIndex(left) - lastUpdateIndex(right) : statusOrder.indexOf(policyStatusLabel(left)) - statusOrder.indexOf(policyStatusLabel(right))), [
		visiblePolicies,
		category,
		search,
		role,
		statusFilter,
		sortMode,
		audit
	]);
	const changedFields = (before, after) => {
		if (before === after) return ["規程內容"];
		try {
			const oldValue = JSON.parse(before);
			const newValue = JSON.parse(after);
			const oldCopy = oldValue.zh || oldValue;
			const newCopy = newValue.zh || newValue;
			const changed = [
				["規程名稱", "title"],
				["摘要", "summary"],
				["規程全文", "content"],
				["表格", "tables"]
			].filter(([, key]) => JSON.stringify(oldCopy?.[key]) !== JSON.stringify(newCopy?.[key])).map(([label]) => label);
			return changed.length ? changed : ["規程內容"];
		} catch {
			return ["規程狀態"];
		}
	};
	const log = (action, before, after, p) => {
		const latestVersion = p.versions.at(-1)?.number;
		const previousVersion = p.versions.at(-2)?.number;
		const versions = action === "發布" ? {
			fromVersion: previousVersion ? `v${previousVersion}` : "未發布",
			toVersion: latestVersion ? `v${latestVersion}` : "發布中"
		} : action === "停用" ? {
			fromVersion: latestVersion ? `v${latestVersion}` : "草稿",
			toVersion: "停用"
		} : action === "新增" ? {
			fromVersion: "未建立",
			toVersion: "草稿"
		} : {
			fromVersion: latestVersion ? `v${latestVersion}` : "未發布",
			toVersion: "草稿"
		};
		return [{
			id: String(Date.now()),
			at: now(),
			actor: name,
			action,
			policy: p.draft.zh.title || p.draft.ja.title,
			code: p.code,
			before,
			after,
			changes: changedFields(before, after),
			...versions
		}, ...audit];
	};
	const open = (p) => {
		setSelectedId(p.id);
		setDraft(clone(p));
		setEditing(false);
		setCompare([Math.max(0, p.versions.length - 2), Math.max(0, p.versions.length - 1)]);
		if (p.approval?.stage === "已承認待發布" && p.changeType === "typo") setNotice("錯字修正沿用既有承認，等待發布日公開");
	};
	const update = (field, value) => setDraft((p) => ({
		...p,
		draft: {
			...p.draft,
			[lang]: {
				...p.draft[lang],
				[field]: value,
				...field === "content" ? { chapters: chaptersFromContent(String(value)) } : {}
			}
		}
	}));
	const updateChapters = (chapters) => setDraft((policy) => ({
		...policy,
		draft: {
			...policy.draft,
			[lang]: {
				...policy.draft[lang],
				chapters,
				content: contentFromChapters(chapters)
			}
		}
	}));
	function saveDraft(e) {
		e?.preventDefault();
		if (!isAdmin) return;
		if (["待部門長承認", "待據點長承認"].includes(draft.approval?.stage || "")) {
			setNotice("此規程已送交承認，請等待承認完成或退回後再修改。");
			return;
		}
		const exists = policies.some((p) => p.id === draft.id), createsContentUpdate = exists && !draft.replacesPolicyId && (draft.changeType === "content" || draft.approval?.stage === "退回修改") && draft.status === "發布" && draft.versions.length > 0, keepsScheduledApproval = draft.approval?.stage === "已承認待發布" && draft.changeType === "typo", before = exists ? JSON.stringify(selected.draft) : "（新增規程）", savedDraft = createsContentUpdate ? {
			...draft,
			id: Date.now(),
			status: "草稿",
			approval: { stage: "草稿" },
			changeType: "content",
			replacesPolicyId: draft.id
		} : exists && draft.status === "停用" && hasSavedDraft(draft) ? {
			...draft,
			status: "停用待更新"
		} : draft;
		saveStore(exists ? createsContentUpdate ? [savedDraft, ...policies] : policies.map((p) => p.id === savedDraft.id ? savedDraft : p) : [savedDraft, ...policies], log(exists ? "修改草稿" : "新增", before, JSON.stringify(savedDraft.draft), savedDraft));
		open(savedDraft);
		setNotice(keepsScheduledApproval ? `錯字修正已儲存，維持已承認狀態，將於 ${draft.publishDate || "發布日"} 公開。` : createsContentUpdate ? "內容更新草稿已建立為獨立規程卡片；原發布版本會持續供員工查看。" : "草稿已儲存；尚未建立發布版本。");
	}
	function switchStatusFilter(nextStatus) {
		setStatusFilter(nextStatus);
		const firstPolicy = visiblePolicies.find((policy) => (category === "全部規程" || policy.category === category) && (nextStatus === "全部" || matchesPolicyStatus(policy, nextStatus)));
		if (firstPolicy) {
			setSelectedId(firstPolicy.id);
			setDraft(clone(firstPolicy));
		}
	}
	function switchCategoryPage(nextCategory) {
		const firstPolicy = visiblePolicies.find((policy) => (nextCategory === "全部規程" || policy.category === nextCategory) && (statusFilter === "全部" || matchesPolicyStatus(policy, statusFilter)));
		setCategory(nextCategory);
		if (firstPolicy) open(firstPolicy);
	}
	function guardEditingNavigation(event) {
		if (!editing) return;
		if (event.target.closest("form")) return;
		if (window.confirm("目前有尚未儲存的編輯內容，是否先儲存草稿？")) saveDraft();
		else {
			setEditing(false);
			setDraft(clone(selected));
		}
	}
	function publishTypoFix() {
		if (!isAdmin) return;
		if (draft.changeType !== "typo" || draft.status !== "發布" || !draft.versions.length || draft.replacesPolicyId || draft.approval?.stage === "退回修改") {
			setNotice("只有已發布規程的純錯字修改可以直接發布。");
			return;
		}
		if (!draft.draft.zh.title && !draft.draft.ja.title) {
			setNotice("請至少填寫一種語言的規程名稱。");
			return;
		}
		const last = draft.versions.at(-1)?.number || "0.0";
		const version = {
			id: String(Date.now()),
			number: nextV(last),
			publishedAt: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
			copy: clone(draft.draft),
			revisionNote: draft.revisionNote || "純錯字修正"
		};
		const next = {
			...draft,
			status: "發布",
			versions: [...draft.versions, version],
			approval: { stage: "草稿" }
		};
		saveStore(policies.map((policy) => policy.id === next.id ? next : policy), log("發布", JSON.stringify(draft.versions.at(-1)?.copy || {}), JSON.stringify(version.copy), next));
		open(next);
		setNotice(`錯字修正已直接發布，v${version.number} 已公開。`);
	}
	function submitForApproval() {
		if (!isAdmin) return;
		if (draft.approval?.stage === "已承認待發布" && draft.changeType === "typo") {
			setNotice("錯字修正會沿用既有承認，等待發布日期即可公開。");
			return;
		}
		const next = {
			...draft,
			status: draft.replacesPolicyId ? "草稿" : draft.versions.length ? "停用待更新" : "草稿",
			approval: {
				stage: "待部門長承認",
				submittedAt: now()
			}
		};
		saveStore(policies.map((p) => p.id === next.id ? next : p), log("送審", JSON.stringify(selected.versions.at(-1)?.copy || {}), JSON.stringify(next.draft), next));
		open(next);
		setNotice(draft.replacesPolicyId ? "內容更新卡片已送交部門長承認；原發布版本持續可供員工查看。" : draft.versions.length ? "原公開版本已停用，已送交部門長承認。" : "已送交部門長承認。");
	}
	function departmentApprove(policy) {
		if (!isDepartmentHead) return;
		const next = {
			...policy,
			approval: {
				...policy.approval,
				stage: "待據點長承認"
			}
		};
		saveStore(policies.map((p) => p.id === next.id ? next : p), log("部門長承認", JSON.stringify(policy.draft), JSON.stringify(next.draft), next));
		setNotice("已承認，已送交據點長承認。");
	}
	function siteApprove(policy) {
		if (!isSiteHead) return;
		const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
		if (policy.publishDate && policy.publishDate > today) {
			const next = {
				...policy,
				status: "已承認",
				approval: {
					...policy.approval,
					stage: "已承認待發布",
					approvedAt: now()
				}
			};
			saveStore(policies.map((p) => p.id === next.id ? next : p), log("據點長承認", JSON.stringify(policy.draft), JSON.stringify(next.draft), next));
			setNotice(`已承認，將於 ${policy.publishDate} 自動發布。`);
			return;
		}
		const last = policy.versions.at(-1)?.number || "0.0";
		const version = {
			id: String(Date.now()),
			number: nextV(last),
			publishedAt: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
			copy: clone(policy.draft),
			revisionNote: policy.revisionNote || "未填寫修訂說明"
		};
		const next = {
			...policy,
			status: "發布",
			versions: [...policy.versions, version],
			approval: { stage: "草稿" },
			replacesPolicyId: void 0
		};
		saveStore(policies.filter((p) => p.id !== policy.replacesPolicyId).map((p) => p.id === next.id ? next : p), log("據點長承認", JSON.stringify(policy.versions.at(-1)?.copy || {}), JSON.stringify(version.copy), next));
		setNotice(`據點長已承認，v${version.number} 已公開。`);
	}
	(0, import_react.useEffect)(() => {
		const releaseDuePolicies = () => {
			const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
			const due = policies.filter((policy) => policy.approval?.stage === "已承認待發布" && policy.publishDate && policy.publishDate <= today);
			if (!due.length) return;
			const replacedIds = new Set(due.map((policy) => policy.replacesPolicyId).filter((id) => typeof id === "number"));
			const released = due.map((policy) => {
				const last = policy.versions.at(-1)?.number || "0.0";
				const version = {
					id: `${Date.now()}-${policy.id}`,
					number: nextV(last),
					publishedAt: today,
					copy: clone(policy.draft),
					revisionNote: policy.revisionNote || "定期發布"
				};
				return {
					...policy,
					status: "發布",
					versions: [...policy.versions, version],
					approval: { stage: "草稿" },
					replacesPolicyId: void 0
				};
			});
			saveStore(policies.filter((policy) => !replacedIds.has(policy.id)).map((policy) => released.find((item) => item.id === policy.id) || policy), released.reduce((records, policy) => [{
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
				changes: ["排程發布"]
			}, ...records], audit));
			setNotice("已依發布日期自動公開新版規程。 ");
		};
		releaseDuePolicies();
		const timer = window.setInterval(releaseDuePolicies, 6e4);
		return () => window.clearInterval(timer);
	}, [policies, audit]);
	function returnForRevision(policy, comment) {
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
				stage: "退回修改",
				returnedAt: now(),
				returnedBy: name,
				returnReason
			}
		};
		const all = policies.map((p) => p.id === next.id ? next : p);
		const nextAudit = log("退回修改", JSON.stringify(policy.draft), JSON.stringify(next.draft), next);
		nextAudit[0] = {
			...nextAudit[0],
			comment: returnReason,
			changes: ["退回意見"]
		};
		saveStore(all, nextAudit);
		setReturnComments((comments) => ({
			...comments,
			[policy.id]: ""
		}));
		setNotice("已退回管理員重新修改。");
	}
	function disable() {
		if (!isAdmin) return;
		const next = {
			...draft,
			status: "停用"
		};
		saveStore(policies.map((p) => p.id === next.id ? next : p), log("停用", JSON.stringify(selected.draft), "規程已停用", next));
		open(next);
		setNotice("規程已停用。");
	}
	function restore(v) {
		if (!isAdmin) return;
		setDraft({
			...draft,
			draft: clone(v.copy),
			status: "草稿"
		});
		setEditing(true);
		setNotice(`已載入版本 ${v.number} 為草稿；發布後才會建立新版本。`);
	}
	const diff = (a, b) => {
		const x = a.split("\n").filter(Boolean), y = b.split("\n").filter(Boolean);
		return [...x.map((t) => ({
			t,
			k: y.includes(t) ? "same" : "remove"
		})), ...y.filter((t) => !x.includes(t)).map((t) => ({
			t,
			k: "add"
		}))];
	};
	const approvalQueue = policies.filter((policy) => isDepartmentHead ? policy.approval?.stage === "待部門長承認" : isSiteHead ? policy.approval?.stage === "待據點長承認" : false);
	const selectedApproval = approvalQueue.find((policy) => policy.id === approvalSelectedId);
	const selectedAuditPolicy = policies.find((policy) => policy.id === auditPolicyId);
	const selectedAuditEntries = selectedAuditPolicy ? audit.filter((entry) => entry.code === selectedAuditPolicy.code) : [];
	const filteredAuditEntries = selectedAuditEntries.filter((entry) => auditActionFilter === "全部" || entry.action === auditActionFilter);
	const auditActionOptions = ["全部", ...Array.from(new Set(selectedAuditEntries.map((entry) => entry.action)))];
	const auditPolicyCards = policies.filter((policy) => `${policy.code} ${policy.draft.zh.title} ${policy.draft.ja.title}`.toLowerCase().includes(auditSearch.toLowerCase()));
	if (view === "approval") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		onClickCapture: guardEditingNavigation,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
			className: "sidebar",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "brand",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "brand-mark",
					children: "人"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "企業規程庫" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "POLICY CENTER" })] })]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				className: "active",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "nav-label",
					children: [ui("✓ 承認待辦", "✓ 承認待ち"), approvalQueue.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {
						className: "pending-dot",
						children: approvalQueue.length
					})]
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				onClick: () => {
					setApprovalSelectedId(null);
					setView("library");
				},
				children: ui("▦ 規程資料庫", "▦ 規程ライブラリ")
			})] })]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "workspace approval-page",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "eyebrow",
						children: "APPROVAL WORKFLOW"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: "承認待ち一覧" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "sub",
						children: "ご自身の承認段階にある全分類の申請を確認し、承認または差戻しを行います。"
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					className: "ghost",
					onClick: () => {
						if (selectedApproval) setApprovalSelectedId(null);
						else setView("library");
					},
					children: selectedApproval ? "← 承認待ち一覧へ戻る" : "← 規程ライブラリへ戻る"
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "approval-flow",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: isDepartmentHead ? "current" : "",
							children: "1. 部門長承認"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { children: "→" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: isSiteHead ? "current" : "",
							children: "2. 拠点長承認"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { children: "→" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "3. 公開" })
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "approval-list",
					children: approvalQueue.length ? selectedApproval ? [selectedApproval].map((policy) => {
						const reviewLang = reviewLanguage(policy);
						const original = policy.versions.at(-1)?.copy[reviewLang].content || "（首次發布，無原始版本）";
						const revised = policy.draft[reviewLang].content;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
							className: "approval-card",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "approval-card-head",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "code",
										children: policy.code
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: policy.draft[reviewLang].title || policy.draft.zh.title })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "status draft",
										children: policy.approval?.stage
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "approval-meta",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["送審：", policy.approval?.submittedAt || "—"] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["公開予定日：", policy.publishDate || "未設定"] })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
									className: "approval-reason",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "改訂理由" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: policy.revisionNote || "改訂理由は未入力です。" })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
									className: "approval-original",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", { children: "原文を確認（前回公開版）" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { children: original })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
									className: "approval-diff",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "変更差分" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "diff-box",
										children: diff(original, revised).map((row, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: row.k,
											children: [row.k === "add" ? "+ " : row.k === "remove" ? "− " : "　", row.t]
										}, index))
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "approval-comment",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "差戻しコメント（Admin に表示）" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
										rows: 3,
										value: returnComments[policy.id] || "",
										onChange: (event) => setReturnComments((comments) => ({
											...comments,
											[policy.id]: event.target.value
										})),
										placeholder: "修正が必要な条文、理由、提案を記入してください"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "approval-actions",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										className: "ghost danger",
										onClick: () => returnForRevision(policy, returnComments[policy.id] || ""),
										children: "差戻して修正依頼"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										className: "primary",
										onClick: () => isDepartmentHead ? departmentApprove(policy) : siteApprove(policy),
										children: isDepartmentHead ? "部門長が承認し拠点長へ送付" : "拠点長が承認して公開"
									})]
								})
							]
						}, policy.id);
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "approval-case-list",
						children: approvalQueue.map((policy) => {
							const reviewLang = reviewLanguage(policy);
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								className: "approval-case-row",
								onClick: () => setApprovalSelectedId(policy.id),
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "approval-case-order",
										children: "案件"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "approval-case-main",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: policy.code }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: policy.draft[reviewLang].title || policy.draft.zh.title }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("small", { children: [
												"申請：",
												policy.approval?.submittedAt || "—",
												"　· 公開予定日：",
												policy.publishDate || "未設定"
											] })
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "status draft",
										children: policy.approval?.stage
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "approval-case-arrow",
										children: "›"
									})
								]
							}, policy.id);
						})
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "empty",
						children: "目前沒有待您承認的規程。"
					})
				})
			]
		})]
	});
	if (view === "audit") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		onClickCapture: guardEditingNavigation,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
			className: "sidebar",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "brand",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "brand-mark",
					children: "人"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "企業規程庫" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "POLICY CENTER" })] })]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				className: "active",
				children: "◷ 修改紀錄"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				onClick: () => {
					setAuditPolicyId(null);
					setView("library");
				},
				children: "▦ 規程資料庫"
			})] })]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "workspace audit-page",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "eyebrow",
					children: "AUDIT TRAIL"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: selectedAuditPolicy ? `${selectedAuditPolicy.code} 修改紀錄` : "修改紀錄" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "sub",
					children: selectedAuditPolicy ? "查看此規程的版本比較與完整異動內容。" : "先選擇規程，再查看各規程的修改紀錄。"
				})
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				className: "ghost",
				onClick: () => {
					if (selectedAuditPolicy) setAuditPolicyId(null);
					else setView("library");
				},
				children: selectedAuditPolicy ? "← 返回規程清單" : "← 返回規程庫"
			})] }), selectedAuditPolicy ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "audit-list",
					children: filteredAuditEntries.length ? filteredAuditEntries.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
						className: "audit-card",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "audit-top",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: `audit-action ${a.action}`,
										children: a.action
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: a.policy }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("time", { children: a.at })
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "操作人：" }),
								a.actor,
								"　",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "規程：" }),
								a.code
							] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "audit-summary",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "audit-version-flow",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "修改前版本" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: a.fromVersion || "歷史版本" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { children: "→" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "修改後版本" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: a.toVersion || "草稿" })
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "audit-changes",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "修改項目" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: (a.changes?.length ? a.changes : changedFields(a.before, a.after)).map((change) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: change }, change)) })]
								})]
							}),
							a.comment && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
								className: "audit-comment",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "退回意見" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: a.comment })]
							})
						]
					}, a.id)) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "empty",
						children: "此規程尚未有修改紀錄。"
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "version-section audit-version-section",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "audit-version-head",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: "版本紀錄與差異比較" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "選擇規程與任意兩個版本，查看內容差異。" })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
							"規程：",
							selectedAuditPolicy.code,
							" ·",
							" ",
							selectedAuditPolicy.draft[lang].title || selectedAuditPolicy.draft.zh.title
						] })]
					}), versions.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "compare-pickers",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["舊版本", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
									value: compare[0],
									onChange: (e) => setCompare([+e.target.value, compare[1]]),
									children: versions.map((v, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
										value: i,
										children: [
											"v",
											v.number,
											" · ",
											v.publishedAt
										]
									}, v.id))
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "→" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["新版本", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
									value: compare[1],
									onChange: (e) => setCompare([compare[0], +e.target.value]),
									children: versions.map((v, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
										value: i,
										children: [
											"v",
											v.number,
											" · ",
											v.publishedAt
										]
									}, v.id))
								})] })
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "diff-box",
							children: diff(versions[compare[0]]?.copy[lang].content || "", versions[compare[1]]?.copy[lang].content || "").map((r, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: r.k,
								children: [r.k === "add" ? "+ " : r.k === "remove" ? "− " : "　", r.t]
							}, i))
						}),
						isAdmin && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "restore-row",
							children: versions.map((v) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								className: "ghost",
								onClick: () => restore(v),
								children: [
									"將 v",
									v.number,
									" 載入草稿"
								]
							}, v.id))
						})
					] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "empty",
						children: "此規程尚未發布任何版本。"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "audit-filter-bar",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["修改類型", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
						value: auditActionFilter,
						onChange: (event) => setAuditActionFilter(event.target.value),
						children: auditActionOptions.map((action) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: action,
							children: action === "全部" ? "全部修改" : action
						}, action))
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
						"共 ",
						filteredAuditEntries.length,
						" 筆紀錄"
					] })]
				})
			] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "toolbar audit-search-toolbar",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "search",
					children: [
						"⌕",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: auditSearch,
							onChange: (event) => setAuditSearch(event.target.value),
							placeholder: "搜尋規程名稱或代碼"
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "result-count",
					children: [
						"共 ",
						auditPolicyCards.length,
						" 項"
					]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "audit-policy-grid",
				children: auditPolicyCards.map((policy) => {
					const entries = audit.filter((entry) => entry.code === policy.code);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						className: "audit-policy-card",
						onClick: () => {
							setAuditActionFilter("全部");
							setAuditPolicyId(policy.id);
							setSelectedId(policy.id);
							setCompare([Math.max(0, policy.versions.length - 2), Math.max(0, policy.versions.length - 1)]);
						},
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "code",
								children: policy.code
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: policy.draft[lang].title || policy.draft.zh.title }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: policy.category }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "audit-policy-meta",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "status draft",
									children: policyStatusLabel(policy)
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
									"已發布 ",
									policy.versions.length,
									" 版"
								] })]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("b", { children: [entries.length, " 筆異動"] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [entries[0]?.at || "尚無紀錄", "　›"] })] })
						]
					}, policy.id);
				})
			})] })]
		})]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		onClickCapture: guardEditingNavigation,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
			className: "sidebar",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "brand",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "brand-mark",
						children: "人"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "企業規程庫" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "POLICY CENTER" })] })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						className: "active",
						children: ui("▦ 規程資料庫", "▦ 規程ライブラリ")
					}),
					isAdmin && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => {
							setAuditPolicyId(null);
							setView("audit");
						},
						children: "◷ 修改紀錄"
					}),
					(isDepartmentHead || isSiteHead) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => {
							setApprovalSelectedId(null);
							setView("approval");
						},
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "nav-label",
							children: [ui("✓ 承認待辦", "✓ 承認待ち"), approvalQueue.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {
								className: "pending-dot",
								children: approvalQueue.length
							})]
						})
					})
				] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "sidebar-foot",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "avatar",
							children: role === "admin" ? "管" : role === "department_head" ? "部" : role === "site_head" ? "據" : "員"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: name }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: role === "admin" ? "Admin · 可管理規程" : role === "department_head" ? "部門長 · 第一次承認" : role === "site_head" ? "拠点長 · 最終承認" : "Employee · 僅可查看" })] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "role-switcher",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "角色預覽" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
								value: role,
								onChange: (event) => changePreviewRole(event.target.value),
								"aria-label": "切換預覽角色",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "admin",
										children: "Admin"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "department_head",
										children: "部門長"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "site_head",
										children: "據點長"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "employee",
										children: "Employee"
									})
								]
							})]
						})
					]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "workspace",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "eyebrow",
						children: ui("企業規程管理系統", "企業規程管理システム")
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: ui("企業規程資料庫", "企業規程ライブラリ") }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "sub",
						children: isAdmin ? "可編輯草稿、發布新版本與管理狀態。" : ui("目前為僅查看模式。", "現在は閲覧モードです。")
					})
				] }), isAdmin && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					className: "primary",
					onClick: () => {
						const p = {
							id: Date.now(),
							category: category === "全部規程" ? "全社基本" : category,
							code: policyCode(category === "全部規程" ? "全社基本" : category, ""),
							effectiveDate: "",
							publishDate: "",
							status: "草稿",
							approval: { stage: "草稿" },
							draft: {
								zh: emptyCopy(),
								ja: emptyCopy()
							},
							versions: []
						};
						setSelectedId(p.id);
						setDraft(p);
						setEditing(true);
					},
					children: "＋ 新增規程"
				})] }),
				notice && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "notice",
					children: ["✓ ", notice]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "toolbar",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "search",
							children: [
								"⌕",
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									value: search,
									onChange: (e) => setSearch(e.target.value),
									placeholder: ui("搜尋規程名稱、代碼或內容", "規程名・コード・本文を検索")
								})
							]
						}),
						role !== "employee" && statusFilter === "全部" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
							value: sortMode,
							onChange: (event) => setSortMode(event.target.value),
							"aria-label": "規程排序方式",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "status",
								children: ui("依狀態排序", "状態順")
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "updated",
								children: ui("依最新修改時間", "最終更新順")
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "result-count",
							children: ui(`共 ${list.length} 項`, `${list.length} 件`)
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
					className: "category-pages",
					"aria-label": "規程分類專屬頁面",
					children: categoryPages.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						className: category === item ? "active" : "",
						onClick: () => switchCategoryPage(item),
						children: [item, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item === "全部規程" ? visiblePolicies.length : visiblePolicies.filter((policy) => policy.category === item).length })]
					}, item))
				}),
				role !== "employee" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "status-bookmarks",
					"aria-label": "依狀態篩選規程",
					children: visibleStatusOptions.map((status) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						className: statusFilter === status ? "active" : "",
						onClick: () => switchStatusFilter(status),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: statusName(status) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: statusCounts[status] })]
					}, status))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "content-grid",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "reg-list",
						children: list.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							className: `reg-card ${p.id === selectedId ? "selected" : ""}`,
							onClick: () => open(p),
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "card-top",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "code",
										children: p.code
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "card-statuses",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: `status ${p.status === "草稿" ? "draft" : ["停用", "停用待更新"].includes(p.status) ? "disabled" : ""}`,
											children: statusName(policyStatusLabel(p))
										}), p.replacesPolicyId && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "status updating",
											children: statusName("規程內容更新版本")
										})]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: policyCopy(p)[lang].title || policyCopy(p).zh.title }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
									p.category,
									" · ",
									lang === "zh" ? "中文" : "日文"
								] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["最新版本 ", p.versions.at(-1)?.number || "未發布"] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("time", { children: p.effectiveDate || "生效日待定" })] })
							]
						}, p.id))
					}), hasNoEmployeePolicies ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("article", {
						className: "detail",
						"aria-label": "尚無可查看的已發布規程"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
						className: "detail",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "detail-head",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "eyebrow",
										children: [
											selected.category,
											" · ",
											selected.code || "NEW"
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: editing ? "編輯草稿" : displayedCopy[selectedDisplayLang].title }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "detail-meta",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "meta-statuses",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: `status ${selected.status === "草稿" ? "draft" : ["停用", "停用待更新"].includes(selected.status) ? "disabled" : ""}`,
													children: statusName(policyStatusLabel(selected))
												}), selected.replacesPolicyId && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "status updating",
													children: statusName("規程內容更新版本")
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["最新版本 ", versions.at(-1)?.number || "未發布"] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["生效日 ", selected.effectiveDate || "待定"] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["發布日 ", selected.publishDate || "據點長承認後立即發布"] }),
											role !== "employee" && selected.approval?.stage && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["核准狀態：", selected.approval.stage] })
										]
									})
								] }), isAdmin && !editing && !isApprovalLocked && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "actions",
									children: [
										canChooseChangeType ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											className: "ghost",
											onClick: () => {
												setDraft({
													...clone(selected),
													changeType: "typo"
												});
												setEditing(true);
											},
											children: "✎ 純錯字修改"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											className: "ghost",
											onClick: () => {
												const pendingUpdate = policies.find((policy) => policy.replacesPolicyId === selected.id);
												if (pendingUpdate) {
													open(pendingUpdate);
													setEditing(true);
													setNotice("已開啟此規程的規程內容更新版本卡片。");
													return;
												}
												setDraft({
													...clone(selected),
													changeType: "content"
												});
												setEditing(true);
											},
											children: "✎ 修改內容事項"
										})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											className: "ghost",
											onClick: () => {
												setDraft(clone(selected));
												setEditing(true);
											},
											children: "✎ 編輯草稿"
										}),
										selected.approval?.stage === "已承認待發布" && selected.changeType === "typo" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											className: "primary",
											onClick: submitForApproval,
											children: "送交部門長承認"
										}),
										selected.status !== "停用" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											className: "ghost danger",
											onClick: disable,
											children: "停用"
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "language-bar",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: isApprover ? "審査表示：日本語優先" : "顯示語言" }), !isApprover && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									className: lang === "zh" ? "selected-lang" : "",
									onClick: () => setLang("zh"),
									children: "繁體中文"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									className: lang === "ja" ? "selected-lang" : "",
									onClick: () => setLang("ja"),
									children: "日本語"
								})] })]
							}),
							editing ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
								onSubmit: saveDraft,
								children: [
									draft.status !== "停用" && (draft.versions.length > 0 || draft.approval?.stage === "已承認待發布") && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "change-type-guide",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: draft.approval?.stage === "退回修改" ? "退回修改：不區分修改類型，完成修正後必須重新送交承認。" : draft.changeType === "typo" ? draft.approval?.stage === "已承認待發布" ? "純錯字修改：沿用既有承認，將於發布日期公開。" : draft.status === "發布" ? "純錯字修改：可不儲存草稿，直接發布新版。" : "純錯字修改：送審後也需依序完成承認。" : "修改內容事項：送審後會先停用原公開版本，再依序承認。" }), draft.approval?.stage !== "退回修改" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "可在下方「變更類型」切換流程。" })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "form-grid",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["規程編號", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "policy-code-input",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [categoryCodePrefix(draft.category), "-"] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													required: true,
													inputMode: "numeric",
													maxLength: 4,
													pattern: "[0-9]{4}",
													"aria-label": "規程編號後四位數字",
													value: policyCodeSuffix(draft.code),
													onChange: (e) => setDraft({
														...draft,
														code: policyCode(draft.category, e.target.value)
													})
												})]
											})] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["規程分類", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												value: draft.category,
												readOnly: true
											})] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["生效日期", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "date",
												value: draft.effectiveDate,
												onChange: (e) => setDraft({
													...draft,
													effectiveDate: e.target.value
												})
											})] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["發布日期", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "date",
												value: draft.publishDate || "",
												onChange: (e) => setDraft({
													...draft,
													publishDate: e.target.value
												})
											})] }),
											draft.status !== "停用" && (draft.versions.length > 0 || draft.approval?.stage === "已承認待發布") && draft.approval?.stage !== "退回修改" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["變更類型", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
												value: draft.changeType || "content",
												onChange: (e) => setDraft({
													...draft,
													changeType: e.target.value
												}),
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: "content",
													children: "修改內容事項（需承認）"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
													value: "typo",
													children: ["純錯字修改", draft.approval?.stage === "已承認待發布" ? "（沿用既有承認）" : "（需承認）"]
												})]
											})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["核准狀態", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												value: draft.approval?.stage === "退回修改" ? "退回修改（需重新承認）" : "草稿",
												readOnly: true
											})] })
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["附件／表單（以逗號分隔）", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										value: (draft.attachments || []).join("、"),
										placeholder: "例如：請假申請表、任用核准單",
										onChange: (e) => setDraft({
											...draft,
											attachments: e.target.value.split(/[、,]/).map((item) => item.trim()).filter(Boolean)
										})
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["關聯規程（以逗號分隔）", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										value: (draft.relatedPolicies || []).join("、"),
										placeholder: "例如：HR-002 出勤與請假管理規程",
										onChange: (e) => setDraft({
											...draft,
											relatedPolicies: e.target.value.split(/[、,]/).map((item) => item.trim()).filter(Boolean)
										})
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["本次修訂說明（發布時會一併記錄）", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
										rows: 2,
										value: draft.revisionNote || "",
										placeholder: "例如：第 2 條新增主管核准流程",
										onChange: (e) => setDraft({
											...draft,
											revisionNote: e.target.value
										})
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "edit-language",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("b", { children: ["正在編輯：", lang === "zh" ? "繁體中文" : "日本語"] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => setLang("zh"),
											children: "繁中"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => setLang("ja"),
											children: "日本語"
										})] })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["規程名稱", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										required: true,
										value: draft.draft[lang].title,
										onChange: (e) => update("title", e.target.value)
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["摘要", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
										rows: 2,
										value: draft.draft[lang].summary,
										onChange: (e) => update("summary", e.target.value)
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StructureEditor, {
										chapters: draft.draft[lang].chapters,
										onChange: updateChapters
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tables, {
										editing: true,
										tables: draft.draft[lang].tables,
										onChange: (x) => update("tables", x)
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "form-actions",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												className: "ghost",
												onClick: () => {
													setDraft(clone(selected));
													setEditing(false);
												},
												children: "取消"
											}),
											draft.changeType === "typo" && draft.status === "發布" && !draft.replacesPolicyId && draft.approval?.stage !== "退回修改" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												className: "primary",
												onClick: publishTypoFix,
												children: "發布錯字修正"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												className: "ghost",
												children: "儲存草稿"
											})
										]
									})
								]
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "summary",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: selectedDisplayLang === "zh" ? "規程摘要" : "規程概要" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: displayedCopy[selectedDisplayLang].summary })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "policy-structure",
									children: (displayedCopy[selectedDisplayLang].chapters || chaptersFromContent(displayedCopy[selectedDisplayLang].content)).map((chapter) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
										className: "policy-chapter",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: chapter.title }), chapter.articles.map((article) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
											className: "policy-article",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: article.title }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: article.text.replace(article.title, "").trim() || article.text })]
										}, article.id))]
									}, chapter.id))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tables, { tables: displayedCopy[selectedDisplayLang].tables }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
									className: "policy-links",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "附件／表單" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: selected.attachments?.length ? selected.attachments.join("、") : "尚未設定附件或表單。" })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "關聯規程" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: selected.relatedPolicies?.length ? selected.relatedPolicies.join("、") : "尚未設定關聯規程。" })] })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
									className: "revision-note",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "最新修訂說明" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: versions.at(-1)?.revisionNote || selected.revisionNote || "尚未填寫修訂說明。" })]
								}),
								isAdmin && hasSavedDraft(selected) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
									className: "pending-draft",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "pending-draft-head",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "已儲存的編輯草稿" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: selected.approval?.stage === "草稿" ? "尚未送審" : selected.approval?.stage })]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("small", { children: ["變更類型：", selected.changeType === "typo" ? "純錯字修改（Admin 可直接發布）" : "修改內容事項（需承認）"] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: selected.draft[lang].title || selected.draft.zh.title }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: selected.draft[lang].summary }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", { children: "查看已儲存的編輯內容" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { children: selected.draft[lang].content })] })
									]
								}),
								isAdmin && selected.approval?.stage === "退回修改" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
									className: "revision-note return-comment",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "承認退回意見" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: selected.approval.returnReason || "尚未填寫退回意見。" }),
										selected.approval.returnedAt && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("small", { children: [
											"退回人：",
											selected.approval.returnedBy || "承認者",
											"退回時間：",
											selected.approval.returnedAt
										] })
									]
								})
							] })
						]
					})]
				})
			]
		})]
	});
}
//#endregion
export { Home as default };
