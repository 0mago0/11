import { z } from "zod";

// DHT 前綴與四位流水號為資料庫及 API 共用的規程識別格式。
export const policyCode = z.string().regex(/^DHT\d{1,2}-\d{4}$/);
export const translation = z.object({
  language: z.enum(["zh-TW", "ja-JP"]),
  title: z.string().min(1),
  summary: z.string().default(""),
  content: z.string().default(""),
  chapters: z.array(z.unknown()).default([]),
  tables: z.array(z.unknown()).default([]),
  images: z.array(z.object({ name: z.string().max(200), dataUrl: z.string().regex(/^data:image\/(png|jpeg|gif|webp);base64,/), alt: z.string().max(300).default("") })).max(5).default([]),
});
const revisionRecord = z.object({
  // 編輯中可先新增空白改訂列，儲存草稿時不應因此阻擋錯字修正或內容修改。
  date: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).default(""),
  content: z.string().default(""),
});
export const policyCreate = z.object({
  policyCode,
  categoryCode: z.string().min(1),
  effectiveDate: z.coerce.date().optional(),
  revisionReason: z.string().default(""),
  revisionDate: z.coerce.date().optional(),
  revisionContent: z.string().default(""),
  revisionRecords: z.array(revisionRecord).default([]),
  translations: z.array(translation).min(1),
});
export const changeDraft = z.object({
  changeKind: z.enum(["new_policy", "typo", "content"]),
  revisionReason: z.string().default(""),
  revisionDate: z.coerce.date().optional(),
  revisionContent: z.string().default(""),
  revisionRecords: z.array(revisionRecord).default([]),
  requestedEffectiveDate: z.coerce.date().optional(),
  scheduledPublishDate: z.coerce.date().optional(),
  translations: z.array(translation).min(1),
});
