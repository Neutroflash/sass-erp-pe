import { Worker } from "bullmq";
import { prisma } from "./lib/prisma";
import { redisConnection } from "./lib/redis";
import { STOCK_HOLD_QUEUE_NAME, StockHoldJobData } from "./lib/stock-hold-queue";
import { releaseOrderHold } from "./domain/orders/resolve-order";
import { SUNAT_RETRY_QUEUE_NAME, SunatRetryJobData } from "./lib/sunat-retry-queue";
import { retryPendingSunatInvoice } from "./domain/invoicing/sunat/retry";

// Proceso separado, siempre corriendo — no comparte proceso con el servidor Next.js. Un solo
// worker sirve a TODOS los tenants a la vez (cada job ya carga su propio orderId/invoiceId con su
// tenantId implícito vía esa fila), no hay un worker por negocio.
const stockHoldWorker = new Worker<StockHoldJobData>(
  STOCK_HOLD_QUEUE_NAME,
  async (job) => {
    const released = await releaseOrderHold(prisma, job.data.orderId);
    console.log(`[stock-hold] orden ${job.data.orderId}: ${released ? "hold liberado (expiró)" : "ya estaba resuelta, no-op"}`);
  },
  { connection: redisConnection },
);

const sunatRetryWorker = new Worker<SunatRetryJobData>(
  SUNAT_RETRY_QUEUE_NAME,
  async (job) => {
    await retryPendingSunatInvoice(prisma, job.data.invoiceId);
    console.log(`[sunat-retry] comprobante ${job.data.invoiceId}: reintento procesado`);
  },
  { connection: redisConnection },
);

console.log("Worker escuchando las colas 'stock-hold' y 'sunat-retry'...");

process.on("SIGTERM", async () => {
  await Promise.all([stockHoldWorker.close(), sunatRetryWorker.close()]);
  process.exit(0);
});
