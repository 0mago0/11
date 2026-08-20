import "dotenv/config";
import pg from "pg";

const { Pool, types } = pg;

// PostgreSQL DATE（OID 1082）本來沒有時區；node-postgres 若自動轉成 Date，
// JSON 回傳時會依伺服器時區偏移。保留原始 YYYY-MM-DD 字串才能正確顯示生效日。
types.setTypeParser(1082, (value) => value);

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Copy .env.example to .env first.");
}

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  // 所有未加 schema 前綴的 SQL 都固定查詢 role_web；public 僅作為 PostgreSQL
  // 擴充套件（例如 citext）與系統函式的後備 search path。
  options: process.env.PGOPTIONS || "-c search_path=role_web,public",
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

export const withTransaction = async (work) => {
  // 發布、承認與稽核紀錄必須同時成功；任何錯誤都回滾，避免出現半完成資料。
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
