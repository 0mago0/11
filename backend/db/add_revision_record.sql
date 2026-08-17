-- 既有資料庫升級：加入公開的「改訂紀錄」欄位。
-- 請在 pgAdmin 的目標資料庫 Query Tool 執行一次。
SET search_path TO role_web, public;

ALTER TABLE policy_versions
  ADD COLUMN IF NOT EXISTS revision_date date,
  ADD COLUMN IF NOT EXISTS revision_content text NOT NULL DEFAULT '';

ALTER TABLE policy_change_requests
  ADD COLUMN IF NOT EXISTS revision_date date,
  ADD COLUMN IF NOT EXISTS revision_content text NOT NULL DEFAULT '';

ALTER TABLE policy_versions
  ADD COLUMN IF NOT EXISTS revision_records jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE policy_change_requests
  ADD COLUMN IF NOT EXISTS revision_records jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE policy_version_translations
  ADD COLUMN IF NOT EXISTS images jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE policy_change_translations
  ADD COLUMN IF NOT EXISTS images jsonb NOT NULL DEFAULT '[]'::jsonb;
