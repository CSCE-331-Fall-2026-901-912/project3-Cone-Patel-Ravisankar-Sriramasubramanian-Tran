import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === "true"
    ? { rejectUnauthorized: false }
    : false,
  connectionTimeoutMillis: 5000,
});

export async function testDatabaseConnection() {
  const result = await pool.query(
    "SELECT current_database() AS database, NOW() AS server_time"
  );

  return result.rows[0];
}
