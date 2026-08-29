import { Worker } from "bullmq";
import { prisma } from "./lib/prisma";
import { redisConnection } from "./lib/redis";
import { STOCK_HOLD_QUEUE_NAME, StockHoldJobData } from "./lib/stock-hold-queue";
import { releaseOrderHold } from "./domain/orders/resolve-order";

// Proceso separado, siempre corriendo — no comparte proceso con el servidor Next.js. Un solo
// worker sirve a TODOS los tenants a la vez (cada job ya carga su propio orderId con su propio
// tenantId implícito vía la orden misma), no hay un worker por negocio.
const worker = new Worker<StockHoldJobData>(
  STOCK_HOLD_QUEUE_NAME,
  async (job) => {
    const released = await releaseOrderHold(prisma, job.data.orderId);
    console.log(`[stock-hold] orden ${job.data.orderId}: ${released ? "hold liberado (expiró)" : "ya estaba resuelta, no-op"}`);
  },
  { connection: redisConnection },
);

console.log("Worker de expiración de reservas de stock escuchando la cola 'stock-hold'...");

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});
