-- 企業規程資料庫：PostgreSQL 初始結構
-- 規程主鍵：DHT1-0000 至 DHT99-0000（固定分類前綴 + 連字號 + 四位數字）
-- 使用者主鍵：A0000（英文大寫字母 + 四位數字）
-- 此檔案供全新 PostgreSQL 資料庫初始化使用。

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE user_role AS ENUM ('admin', 'employee', 'department_head', 'site_head');
CREATE TYPE language_code AS ENUM ('zh-TW', 'ja-JP');
CREATE TYPE published_policy_status AS ENUM ('published', 'disabled');
CREATE TYPE change_kind AS ENUM ('new_policy', 'typo', 'content');
CREATE TYPE change_request_status AS ENUM (
  'draft',
  'pending_department_head',
  'pending_site_head',
  'approved_scheduled',
  'returned_for_revision',
  'published',
  'cancelled'
);
CREATE TYPE approval_decision AS ENUM ('pending', 'approved', 'returned');
CREATE TYPE audit_action AS ENUM (
  'created', 'draft_saved', 'submitted', 'department_approved',
  'site_approved', 'returned', 'published', 'disabled', 'restored'
);

-- 固定分類及其規程編號前綴；前綴由資料庫檢查，使用者不可自行指定。
CREATE TABLE policy_categories (
  category_code varchar(20) PRIMARY KEY,
  name_zh text NOT NULL UNIQUE,
  name_ja text NOT NULL,
  code_prefix varchar(5) NOT NULL CHECK (code_prefix ~ '^DHT[0-9]{1,2}$'),
  sort_order smallint NOT NULL UNIQUE CHECK (sort_order > 0),
  is_active boolean NOT NULL DEFAULT true
);

INSERT INTO policy_categories (category_code, name_zh, name_ja, code_prefix, sort_order) VALUES
  ('basic', '全社基本', '全社基本', 'DHT1', 1),
  ('hr', '人事', '人事', 'DHT2', 2),
  ('it', 'IT管理', 'IT管理', 'DHT3', 3),
  ('general_affairs', '總務', '総務', 'DHT3', 4),
  ('sales', '營業管理', '営業管理', 'DHT4', 5),
  ('accounting', '會計管理', '会計管理', 'DHT5', 6),
  ('ehs', 'EHS', 'EHS', 'DHT6', 7),
  ('import_export', '進出口管理', '輸出入管理', 'DHT7', 8),
  ('cow', 'COW', 'COW', 'DHT10', 9),
  ('iso9001', 'ISO9001', 'ISO9001', 'DHT99', 10);

CREATE TABLE users (
  employee_no char(5) PRIMARY KEY CHECK (employee_no ~ '^[A-Z][0-9]{4}$'),
  display_name text NOT NULL,
  email citext UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_roles (
  employee_no char(5) NOT NULL REFERENCES users(employee_no),
  role user_role NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by char(5) REFERENCES users(employee_no),
  PRIMARY KEY (employee_no, role)
);

-- 預留系統排程、資料移轉等無真人操作者的紀錄。
INSERT INTO users (employee_no, display_name) VALUES ('A0000', 'System')
ON CONFLICT (employee_no) DO NOTHING;

-- 規程本體只保存公開狀態與目前公開版；草稿與承認流程保存在 change_requests。
CREATE TABLE policies (
  policy_code varchar(10) PRIMARY KEY CHECK (policy_code ~ '^DHT[0-9]{1,2}-[0-9]{4}$'),
  category_code varchar(20) NOT NULL REFERENCES policy_categories(category_code),
  status published_policy_status NOT NULL DEFAULT 'disabled',
  effective_date date,
  published_at timestamptz,
  disabled_at timestamptz,
  disabled_by char(5) REFERENCES users(employee_no),
  current_version_no integer,
  created_by char(5) NOT NULL REFERENCES users(employee_no),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- 停用規程仍需保留最後公開版，才能保留歷史內容並以該版為基礎建立更新申請。
  CHECK (status = 'published' OR current_version_no IS NULL OR current_version_no > 0)
);

-- 既有資料庫升級用：若已由舊 schema 建立，請一併套用這段。
ALTER TABLE policies DROP CONSTRAINT IF EXISTS policies_check;
ALTER TABLE policies ADD CONSTRAINT policies_check
  CHECK (status = 'published' OR current_version_no IS NULL OR current_version_no > 0);

-- 每次公開新增一筆，不允許 UPDATE 或 DELETE，以符合舊版本不可覆蓋。
CREATE TABLE policy_versions (
  policy_code varchar(10) NOT NULL REFERENCES policies(policy_code),
  version_no integer NOT NULL CHECK (version_no > 0),
  effective_date date NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by char(5) NOT NULL REFERENCES users(employee_no),
  revision_note text,
  source_change_request_id uuid,
  PRIMARY KEY (policy_code, version_no)
);

ALTER TABLE policies
  ADD CONSTRAINT policies_current_version_fk
  FOREIGN KEY (policy_code, current_version_no)
  REFERENCES policy_versions(policy_code, version_no)
  DEFERRABLE INITIALLY DEFERRED;

-- 每個版本的中文／日文內容。content、chapters、tables 以 JSONB 保存可編輯結構。
CREATE TABLE policy_version_translations (
  policy_code varchar(10) NOT NULL,
  version_no integer NOT NULL,
  language language_code NOT NULL,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  chapters jsonb NOT NULL DEFAULT '[]'::jsonb,
  tables jsonb NOT NULL DEFAULT '[]'::jsonb,
  PRIMARY KEY (policy_code, version_no, language),
  FOREIGN KEY (policy_code, version_no)
    REFERENCES policy_versions(policy_code, version_no) ON DELETE RESTRICT,
  CHECK (jsonb_typeof(chapters) = 'array'),
  CHECK (jsonb_typeof(tables) = 'array')
);

-- 一次送審即是一筆變更申請；可由既有公開版本或新規程開始。
CREATE TABLE policy_change_requests (
  change_request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_code varchar(10) NOT NULL REFERENCES policies(policy_code),
  base_version_no integer,
  change_kind change_kind NOT NULL,
  status change_request_status NOT NULL DEFAULT 'draft',
  revision_reason text NOT NULL DEFAULT '',
  requested_effective_date date,
  scheduled_publish_date date,
  requires_approval boolean NOT NULL DEFAULT true,
  submitted_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz,
  created_by char(5) NOT NULL REFERENCES users(employee_no),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (policy_code, base_version_no)
    REFERENCES policy_versions(policy_code, version_no) ON DELETE RESTRICT,
  CHECK (
    (change_kind = 'new_policy' AND base_version_no IS NULL)
    OR (change_kind <> 'new_policy' AND base_version_no IS NOT NULL)
  ),
  CHECK (scheduled_publish_date IS NULL OR requested_effective_date IS NULL
         OR scheduled_publish_date >= requested_effective_date)
);

CREATE UNIQUE INDEX one_open_change_request_per_policy
  ON policy_change_requests(policy_code)
  WHERE status IN ('draft', 'pending_department_head', 'pending_site_head',
                   'approved_scheduled', 'returned_for_revision');

CREATE TABLE policy_change_translations (
  change_request_id uuid NOT NULL REFERENCES policy_change_requests(change_request_id) ON DELETE CASCADE,
  language language_code NOT NULL,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  chapters jsonb NOT NULL DEFAULT '[]'::jsonb,
  tables jsonb NOT NULL DEFAULT '[]'::jsonb,
  PRIMARY KEY (change_request_id, language),
  CHECK (jsonb_typeof(chapters) = 'array'),
  CHECK (jsonb_typeof(tables) = 'array')
);

-- 固定兩關：部門長先承認，據點長後承認。退回意見與退回人均保存。
CREATE TABLE change_request_approvals (
  approval_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_request_id uuid NOT NULL REFERENCES policy_change_requests(change_request_id) ON DELETE CASCADE,
  approval_step smallint NOT NULL CHECK (approval_step IN (1, 2)),
  required_role user_role NOT NULL CHECK (required_role IN ('department_head', 'site_head')),
  decision approval_decision NOT NULL DEFAULT 'pending',
  decided_by char(5) REFERENCES users(employee_no),
  decided_at timestamptz,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (change_request_id, approval_step),
  UNIQUE (change_request_id, required_role),
  CHECK (
    (decision = 'pending' AND decided_by IS NULL AND decided_at IS NULL)
    OR (decision <> 'pending' AND decided_by IS NOT NULL AND decided_at IS NOT NULL)
  ),
  CHECK (
    (approval_step = 1 AND required_role = 'department_head')
    OR (approval_step = 2 AND required_role = 'site_head')
  )
);

CREATE TABLE policy_attachments (
  attachment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_code varchar(10) NOT NULL REFERENCES policies(policy_code) ON DELETE CASCADE,
  version_no integer,
  file_name text NOT NULL,
  file_url text NOT NULL,
  created_by char(5) NOT NULL REFERENCES users(employee_no),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (policy_code, version_no)
    REFERENCES policy_versions(policy_code, version_no) ON DELETE RESTRICT
);

CREATE TABLE policy_relations (
  policy_code varchar(10) NOT NULL REFERENCES policies(policy_code) ON DELETE CASCADE,
  related_policy_code varchar(10) NOT NULL REFERENCES policies(policy_code) ON DELETE RESTRICT,
  PRIMARY KEY (policy_code, related_policy_code),
  CHECK (policy_code <> related_policy_code)
);

-- 稽核紀錄保存修改前後快照及版本，禁止竄改。
CREATE TABLE policy_audit_logs (
  audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_employee_no char(5) NOT NULL REFERENCES users(employee_no),
  policy_code varchar(10) NOT NULL REFERENCES policies(policy_code),
  change_request_id uuid REFERENCES policy_change_requests(change_request_id) ON DELETE SET NULL,
  action audit_action NOT NULL,
  from_version_no integer,
  to_version_no integer,
  changed_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  before_content jsonb,
  after_content jsonb,
  comment text,
  CHECK (jsonb_typeof(changed_fields) = 'array')
);

CREATE TABLE user_notifications (
  notification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_no char(5) NOT NULL REFERENCES users(employee_no) ON DELETE CASCADE,
  change_request_id uuid REFERENCES policy_change_requests(change_request_id) ON DELETE CASCADE,
  message text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX policy_change_requests_queue_idx
  ON policy_change_requests(status, scheduled_publish_date, created_at DESC);
CREATE INDEX policy_audit_logs_policy_idx
  ON policy_audit_logs(policy_code, occurred_at DESC);
CREATE INDEX user_notifications_unread_idx
  ON user_notifications(employee_no, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX policy_version_zh_search_idx
  ON policy_version_translations USING gin (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(content, ''))
  ) WHERE language = 'zh-TW';

-- 分類固定前綴檢查：例如人事分類只能使用 DHT2-0001。
CREATE FUNCTION enforce_policy_code_prefix() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE expected_prefix varchar(5);
BEGIN
  SELECT code_prefix INTO expected_prefix
  FROM policy_categories WHERE category_code = NEW.category_code;
  IF NEW.policy_code <> expected_prefix || '-' || right(NEW.policy_code, 4) THEN
    RAISE EXCEPTION 'policy_code % does not match category prefix %', NEW.policy_code, expected_prefix;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER policies_enforce_code_prefix
  BEFORE INSERT OR UPDATE OF policy_code, category_code ON policies
  FOR EACH ROW EXECUTE FUNCTION enforce_policy_code_prefix();

CREATE FUNCTION deny_immutable_history_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is immutable; create a new version or audit record instead', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER policy_versions_immutable
  BEFORE UPDATE OR DELETE ON policy_versions
  FOR EACH ROW EXECUTE FUNCTION deny_immutable_history_change();
CREATE TRIGGER policy_version_translations_immutable
  BEFORE UPDATE OR DELETE ON policy_version_translations
  FOR EACH ROW EXECUTE FUNCTION deny_immutable_history_change();
CREATE TRIGGER policy_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON policy_audit_logs
  FOR EACH ROW EXECUTE FUNCTION deny_immutable_history_change();

-- Employee 可用的公開規程查詢視圖：只包含發布中的最新版本與中日文內容。
CREATE VIEW employee_published_policies AS
SELECT
  p.policy_code, c.name_zh AS category_zh, c.name_ja AS category_ja,
  p.effective_date, p.published_at, p.current_version_no,
  t.language, t.title, t.summary, t.content, t.chapters, t.tables
FROM policies p
JOIN policy_categories c ON c.category_code = p.category_code
JOIN policy_version_translations t
  ON t.policy_code = p.policy_code AND t.version_no = p.current_version_no
WHERE p.status = 'published';

-- 建議的發佈交易：
-- 1. INSERT policy_versions + 兩筆 policy_version_translations；
-- 2. UPDATE policy_change_requests 為 published；
-- 3. UPDATE policies 設 current_version_no、status = published；
-- 4. INSERT policy_audit_logs；全部放在同一個 BEGIN / COMMIT 交易中執行。
