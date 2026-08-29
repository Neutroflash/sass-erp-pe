import { Queue } from "bullmq";
import { redisConnection } from "./redis";

export const SUNAT_RETRY_QUEUE_NAME = "sunat-retry";

export interface SunatRetryJobData {
  invoiceId: string;
}

const sunatRetryQueue = new Queue<SunatRetryJobData>(SUNAT_RETRY_QUEUE_NAME, { connection: redisConnection });

// Backoff creciente (2min, 4min, 8min...) — SUNAT caído no se resuelve reintentando cada pocos
// segundos, y machacar su Web Service con reintentos agresivos no ayuda a nadie.
function backoffMs(attempt: number): number {
  return Math.min(2 ** attempt, 60) * 60 * 1000;
}

// jobId incluye el intento (no solo invoiceId) a propósito: cada reintento es un job NUEVO con su
// propio delay/backoff, a diferencia del hold de stock (una sola espera fija) — acá puede haber
// varios reintentos encolados en sucesión a medida que cada uno falla.
export const sunatRetryScheduler = {
  async schedule(invoiceId: string, attempt = 0): Promise<void> {
    await sunatRetryQueue.add(
      "retry",
      { invoiceId },
      { jobId: `${invoiceId}-${attempt}`, delay: backoffMs(attempt), removeOnComplete: true, removeOnFail: true },
    );
  },
};

export { sunatRetryQueue };
