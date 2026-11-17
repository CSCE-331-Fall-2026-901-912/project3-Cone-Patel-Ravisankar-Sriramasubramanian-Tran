import { pool } from "../db.js";

export function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    try {
      const googleId = req.session?.user?.googleId;

      if (!googleId) {
        return res.status(401).json({
          error: "Sign in required",
        });
      }

      const result = await pool.query(
        `SELECT e.employee_id, e.role
         FROM employee e
         JOIN user_accounts a
           ON e.account_id = a.account_id
         WHERE a.google_id = $1`,
        [googleId]
      );

      const employee = result.rows[0];

      if (!employee || !allowedRoles.includes(employee.role)) {
        return res.status(403).json({
          error: "You do not have permission to access this resource",
        });
      }

      req.employee = employee;
      next();
    } catch (error) {
      next(error);
    }
  };
}