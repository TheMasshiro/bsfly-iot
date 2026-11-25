import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { closeDb, connectDb } from "./index.js";

const db = connectDb();
await migrate(db, { migrationsFolder: new URL("../../drizzle", import.meta.url).pathname });
await closeDb();
console.log("Migrations applied");
