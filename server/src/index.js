import "dotenv/config";
import { createApp } from "./app.js";
import { closeDb, connectDb } from "./db/index.js";
import { startJobs, stopJobs } from "./services/jobs.js";
import { closeMqtt, initMqtt } from "./services/mqtt.js";

connectDb();
initMqtt();
startJobs();

const port = Number(process.env.PORT || 5000);
const server = createApp().listen(port, () => console.log(`API listening on :${port}`));

const shutdown = async () => {
  stopJobs();
  closeMqtt();
  server.close();
  await closeDb();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
