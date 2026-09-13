import { buildApp } from "./app.js";
import { enablePersistence } from "./persistence.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

if (process.env.DATA_DIR) {
  enablePersistence(process.env.DATA_DIR, (msg) => console.log(`[server] ${msg}`));
}

const app = await buildApp();

await app.listen({ port, host });
app.log.info(`Salary AI API listening on http://${host}:${port}`);
