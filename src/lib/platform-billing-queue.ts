import { Queue } from "bullmq";
import { redisConnection } from "./redis";

export const PLATFORM_BILLING_QUEUE_NAME = "platform-billing";

const platformBillingQueue = new Queue(PLATFORM_BILLING_QUEUE_NAME, { connection: redisConnection });

/**
 * Job recurrente (no un `schedule()` puntual como stock-hold/sunat-retry) — corre una vez al día
 * y en cada corrida escanea TODAS las suscripciones vencidas (`runDueBillingCycles`), no una en
 * particular. `jobId` fijo para que registrar el repeatable job dos veces (ej. en cada reinicio
 * del worker) sea un no-op, no un job duplicado.
 */
export async function ensurePlatformBillingRepeatingJob(): Promise<void> {
  await platformBillingQueue.add(
    "run-due-cycles",
    {},
    {
      jobId: "platform-billing-daily",
      repeat: { pattern: "0 3 * * *" },
      removeOnComplete: true,
      // Cada corrida es idempotente por tenant (ver runBillingCycleForTenant) — un reintento no
      // duplica cobros, así que si algo transitorio tira la corrida completa, mejor reintentar en
      // minutos que dejar suscripciones vencidas sin cobrar hasta la corrida del día siguiente.
      attempts: 3,
      backoff: { type: "exponential", delay: 60_000 },
      removeOnFail: true,
    },
  );
}

export { platformBillingQueue };
