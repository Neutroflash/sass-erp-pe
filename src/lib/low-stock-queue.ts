import { Queue } from "bullmq";
import { redisConnection } from "./redis";

export const LOW_STOCK_QUEUE_NAME = "low-stock";

const lowStockQueue = new Queue(LOW_STOCK_QUEUE_NAME, { connection: redisConnection });

/**
 * Job recurrente diario — mismo patrón que `platform-billing-queue.ts` (jobId fijo, registrar el
 * repeatable job en cada arranque del worker es un no-op, no un job duplicado). `13 * * *` = 8am
 * hora Perú (UTC-5, sin horario de verano) — mañana, no de madrugada como el cobro de plataforma,
 * porque a esta sí le interesa que el OWNER la vea apenas abre el día.
 */
export async function ensureLowStockRepeatingJob(): Promise<void> {
  await lowStockQueue.add(
    "run-digest",
    {},
    {
      jobId: "low-stock-daily",
      repeat: { pattern: "0 13 * * *" },
      removeOnComplete: true,
      attempts: 3,
      backoff: { type: "exponential", delay: 60_000 },
      removeOnFail: true,
    },
  );
}

export { lowStockQueue };
