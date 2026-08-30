import { Queue } from "bullmq";
import { redisConnection } from "./redis";

export const STOCK_HOLD_QUEUE_NAME = "stock-hold";

export interface StockHoldJobData {
  orderId: string;
}

export const stockHoldQueue = new Queue<StockHoldJobData>(STOCK_HOLD_QUEUE_NAME, { connection: redisConnection });

const STOCK_HOLD_MINUTES = Number(process.env.STOCK_HOLD_MINUTES ?? 15);

// jobId = orderId: hace que schedule() sea naturalmente idempotente (llamarlo dos veces para la
// misma orden no duplica el job), y que cancel() pueda referenciar el job sin guardar su id en
// ningún otro lado.
export const stockHoldScheduler = {
  async schedule(orderId: string): Promise<void> {
    await stockHoldQueue.add(
      "expire",
      { orderId },
      {
        jobId: orderId,
        delay: STOCK_HOLD_MINUTES * 60 * 1000,
        removeOnComplete: true,
        // 3 intentos con backoff exponencial (5s, 25s, 125s) antes de darse por vencido — sin esto,
        // un error transitorio (ej. la DB reinicia justo cuando expira el hold) borra el job para
        // siempre y la orden queda PENDING_PAYMENT con stock reservado bloqueado sin fin.
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnFail: true,
      },
    );
  },
  async cancel(orderId: string): Promise<void> {
    const job = await stockHoldQueue.getJob(orderId);
    await job?.remove();
  },
};
