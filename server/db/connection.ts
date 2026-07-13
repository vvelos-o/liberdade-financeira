import { drizzle } from "drizzle-orm/mysql2";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// Data Cutoff: Ignore all Pluggy transactions before this date (user started tracking from July 2026)
export const DATA_CUTOFF_DATE = new Date(2026, 5, 1); // June 1, 2026 (month is 0-indexed)
export const DATA_CUTOFF_YEAR = 2026;
export const DATA_CUTOFF_MONTH = 7;
