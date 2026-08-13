-- 已建立資料庫後，補齊開發／驗收用的四個登入帳號。
-- 請在 pgAdmin 的目標資料庫 Query Tool 執行此檔。
SET search_path TO role_web, public;

INSERT INTO users (employee_no, display_name) VALUES
  ('A0001', 'Admin'),
  ('A0002', 'Employee'),
  ('A0003', '部門長'),
  ('A0004', '據點長')
ON CONFLICT (employee_no) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  is_active = true;

INSERT INTO user_roles (employee_no, role) VALUES
  ('A0001', 'admin'),
  ('A0002', 'employee'),
  ('A0003', 'department_head'),
  ('A0004', 'site_head')
ON CONFLICT (employee_no, role) DO NOTHING;
