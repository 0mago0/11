import { db } from "./db.js";

// 開發／驗收用四個帳號。正式接公司 API 時設 AUTH_PROVIDER=company_api，
// 並只需替換 authenticateWithCompanyApi()；下方資料庫角色與各路由權限無須改動。
const demoAccounts = [
  { employeeNo: "A0001", password: process.env.DEMO_ADMIN_PASSWORD || "admin123" },
  { employeeNo: "A0002", password: process.env.DEMO_EMPLOYEE_PASSWORD || "employee123" },
  { employeeNo: "A0003", password: process.env.DEMO_DEPARTMENT_HEAD_PASSWORD || "department123" },
  { employeeNo: "A0004", password: process.env.DEMO_SITE_HEAD_PASSWORD || "site123" },
];

// pg 通常會把 PostgreSQL array 轉成 JavaScript 陣列；但部分驅動／型別設定會
// 回傳 `{admin,employee}` 形式的字串。登入邊界統一轉換，後續路由可安全使用 some/includes。
const normalizeRoles = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (!value) return [];
  return String(value)
    .replace(/^\{/, "")
    .replace(/\}$/, "")
    .split(",")
    .map((role) => role.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
};

const loadActiveUser = async (employeeNo) => {
  const { rows } = await db.query(
    `SELECT u.employee_no, u.display_name, array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL) AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.employee_no = u.employee_no
      WHERE u.employee_no = $1 AND u.is_active = true
      GROUP BY u.employee_no, u.display_name`,
    [employeeNo],
  );
  return rows[0] ? { ...rows[0], roles: normalizeRoles(rows[0].roles) } : null;
};

/**
 * 公司 API 串接點：預期回傳 { employeeNo }，或拋出驗證失敗錯誤。
 * 之後可在此用 fetch 呼叫公司 SSO／人資 API，再以 employeeNo 載入本系統角色。
 */
const authenticateWithCompanyApi = async (_account, _password) => {
  throw new Error("Company authentication API is not configured.");
};

export const signIn = async (account, password) => {
  const accountId = String(account || "").trim().toUpperCase();
  let employeeNo;
  if (process.env.AUTH_PROVIDER === "company_api") {
    ({ employeeNo } = await authenticateWithCompanyApi(accountId, password));
  } else {
    const matched = demoAccounts.find(
      (item) => item.employeeNo === accountId && item.password === String(password || ""),
    );
    if (!matched) return null;
    employeeNo = matched.employeeNo;
  }
  return loadActiveUser(employeeNo);
};

export const authenticate = async (req, res, next) => {
  // 此專案以員編 header 示範登入；正式環境應替換為 SSO/JWT 驗證後再設定 req.user。
  const employeeNo = req.header("X-Employee-No")?.trim().toUpperCase();
  if (!employeeNo || !/^[A-Z][0-9]{4}$/.test(employeeNo)) {
    return res.status(401).json({ error: "X-Employee-No must be in A0000 format." });
  }

  const user = await loadActiveUser(employeeNo);
  if (!user) return res.status(401).json({ error: "Active user not found." });
  req.user = user;
  next();
};

export const requireRole = (...roles) => (req, res, next) => {
  // 一個帳號可同時擁有多個角色，只要其中一個符合即可通過。
  if (!roles.some((role) => req.user.roles.includes(role))) {
    return res.status(403).json({ error: "Insufficient role." });
  }
  next();
};

export const isAdmin = (user) => user.roles.includes("admin");
