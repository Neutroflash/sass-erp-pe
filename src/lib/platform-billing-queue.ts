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
    { jobId: "platform-billing-daily", repeat: { pattern: "0 3 * * *" }, removeOnComplete: true, removeOnFail: true },
  );
}

export { platformBillingQueue };
