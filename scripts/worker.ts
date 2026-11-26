import { runWorkerLoop } from "../src/lib/services/worker";

/**
 * Background worker. Polls the database for PENDING orders and provisions
 * them through the mocked providers. Run with `npm run worker`.
 * Stops cleanly on SIGINT / SIGTERM.
 */
const controller = new AbortController();

process.on("SIGINT", () => controller.abort());
process.on("SIGTERM", () => controller.abort());

runWorkerLoop({ signal: controller.signal }).catch((err) => {
  console.error(err);
  process.exit(1);
});
