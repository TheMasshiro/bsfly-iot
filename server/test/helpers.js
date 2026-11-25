import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { useDb } from "../src/db/index.js";
import * as schema from "../src/db/schema.js";
import { createApp } from "../src/app.js";

export async function startTestServer() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });
  useDb(db);

  const identify = (req, _res, next) => {
    req.userId = req.headers["x-test-user"] ?? null;
    next();
  };
  const server = createApp({ identify }).listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const call = async (method, path, { user, key, body } = {}) => {
    const headers = { "content-type": "application/json" };
    if (user) headers["x-test-user"] = user;
    if (key) headers["x-api-key"] = key;
    const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: res.status, body: json };
  };

  const stop = async () => {
    server.close();
    await client.close();
  };

  return { db, call, stop };
}
