import { db } from "./db.js";

export const authenticate = async (req, res, next) => {
  // 此專案以員編 header 示範登入；正式環境應替換為 SSO/JWT 驗證後再設定 req.user。
  const employeeNo = req.header("X-Employee-No")?.trim().toUpperCase();
  if (!employeeNo || !/^[A-Z][0-9]{4}$/.test(employeeNo)) {
    return res.status(401).json({ error: "X-Employee-No must be in A0000 format." });
  }

  const { rows } = await db.query(
    `SELECT u.employee_no, u.display_name, array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL) AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.employee_no = u.employee_no
      WHERE u.employee_no = $1 AND u.is_active = true
      GROUP BY u.employee_no, u.display_name`,
    [employeeNo],
  );
  if (!rows[0]) return res.status(401).json({ error: "Active user not found." });
  req.user = { ...rows[0], roles: rows[0].roles || [] };
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
