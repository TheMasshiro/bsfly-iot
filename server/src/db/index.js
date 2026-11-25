import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

export let db = null;
let pool = null;

export function connectDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL is not set");
  pool = new pg.Pool({ connectionString: url, max: Number(process.env.DB_POOL_MAX || 5) });
  db = drizzle(pool, { schema });
  return db;
}

export function useDb(instance) {
  db = instance;
}

export async function closeDb() {
  await pool?.end();
  pool = null;
}
