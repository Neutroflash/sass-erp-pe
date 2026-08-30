import { Queue } from "bullmq";
import { redisConnection } from "./redis";

export const GRE_TICKET_QUEUE_NAME = "gre-ticket";

export interface GreTicketJobData {
  dispatchGuideId: string;
  attempt: number;
}

const greTicketQueue = new Queue<GreTicketJobData>(GRE_TICKET_QUEUE_NAME, { connection: redisConnection });

/**
 * A diferencia de sunat-retry (reintenta un ENVÍO que falló), esto consulta el RESULTADO de un
 * envío que SUNAT ya recibió (`numTicket`) — el ticket normalmente resuelve en segundos/minutos,
 * pero el primer chequeo espera 30s (no tiene sentido consultar antes de eso) y cada reintento (si
 * sigue "en proceso") espera el doble, hasta `maxAttempts`.
 */
export const greTicketScheduler = {
  async schedule(dispatchGuideId: string, attempt = 0): Promise<void> {
    const delayMs = 30_000 * 2 ** attempt;
    await greTicketQueue.add(
      "check",
      { dispatchGuideId, attempt },
      { jobId: `${dispatchGuideId}-${attempt}`, delay: delayMs, removeOnComplete: true, removeOnFail: true },
    );
  },
};

export { greTicketQueue };
