import { Worker } from "bullmq";
import { prisma } from "./lib/prisma";
import { redisConnection } from "./lib/redis";
import { STOCK_HOLD_QUEUE_NAME, StockHoldJobData } from "./lib/stock-hold-queue";
import { releaseOrderHold } from "./domain/orders/resolve-order";
import { SUNAT_RETRY_QUEUE_NAME, SunatRetryJobData } from "./lib/sunat-retry-queue";
import { retryPendingSunatInvoice } from "./domain/invoicing/sunat/retry";
import { PLATFORM_BILLING_QUEUE_NAME, ensurePlatformBillingRepeatingJob } from "./lib/platform-billing-queue";
import { runDueBillingCycles } from "./domain/platform-billing/billing-cycle";
import { LOW_STOCK_QUEUE_NAME, ensureLowStockRepeatingJob } from "./lib/low-stock-queue";
import { runLowStockDigest } from "./domain/inventory/low-stock";

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

// Job recurrente (no puntual como los otros dos) — corre una vez al día, escanea TODAS las
// suscripciones vencidas. El registro del repeatable job (ensurePlatformBillingRepeatingJob) vive
// acá, al arrancar el worker, no en el servidor web — es este proceso el dueño del ciclo de vida
// de las colas recurrentes.
const platformBillingWorker = new Worker(
  PLATFORM_BILLING_QUEUE_NAME,
  async () => {
    const processed = await runDueBillingCycles(prisma);
    console.log(`[platform-billing] ${processed} suscripción(es) vencida(s) procesada(s)`);
  },
  { connection: redisConnection },
);
void ensurePlatformBillingRepeatingJob();

const lowStockWorker = new Worker(
  LOW_STOCK_QUEUE_NAME,
  async () => {
    const notified = await runLowStockDigest(prisma);
    console.log(`[low-stock] ${notified} negocio(s) notificado(s)`);
  },
  { connection: redisConnection },
);
void ensureLowStockRepeatingJob();

// Sin esto, un job que agota sus reintentos (o una excepción no esperada dentro del handler) no
// deja ningún rastro — con removeOnFail:true en las 3 colas, el job simplemente desaparece. Estos
// listeners son la única visibilidad real que tiene un operador para notar que algo se rompió.
for (const [name, worker] of [
  ["stock-hold", stockHoldWorker],
  ["sunat-retry", sunatRetryWorker],
  ["platform-billing", platformBillingWorker],
  ["low-stock", lowStockWorker],
] as const) {
  worker.on("failed", (job, err) => {
    console.error(`[${name}] job ${job?.id ?? "?"} falló tras ${job?.attemptsMade ?? "?"} intento(s):`, err);
  });
  worker.on("error", (err) => {
    console.error(`[${name}] error de conexión/infraestructura del worker:`, err);
  });
}

console.log("Worker escuchando las colas 'stock-hold', 'sunat-retry', 'platform-billing' y 'low-stock'...");

// Deja que el proceso termine con una traza en logs en vez de morir en silencio — la política de
// reinicio la impone la plataforma de hosting (Render/systemd/Docker `restart: always`/PM2), acá
// solo se garantiza que cuando reinicie, quede escrito por qué.
process.on("unhandledRejection", (reason) => {
  console.error("[worker] unhandledRejection:", reason);
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  console.error("[worker] uncaughtException:", err);
  process.exit(1);
});

async function shutdown(signal: string) {
  console.log(`[worker] ${signal} recibido, cerrando workers...`);
  await Promise.all([stockHoldWorker.close(), sunatRetryWorker.close(), platformBillingWorker.close(), lowStockWorker.close()]);
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
