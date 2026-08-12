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
});
export const policyCreate = z.object({
  policyCode,
  categoryCode: z.string().min(1),
  effectiveDate: z.coerce.date().optional(),
  revisionReason: z.string().default(""),
  translations: z.array(translation).min(1),
});
export const changeDraft = z.object({
  changeKind: z.enum(["new_policy", "typo", "content"]),
  revisionReason: z.string().default(""),
  requestedEffectiveDate: z.coerce.date().optional(),
  scheduledPublishDate: z.coerce.date().optional(),
  translations: z.array(translation).min(1),
});
