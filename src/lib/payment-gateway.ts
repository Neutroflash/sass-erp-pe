import type { PrismaClient } from "@prisma/client";
import { resolveIzipayCredentials } from "./izipay-credentials";
import { IzipayPaymentGateway } from "@/domain/payments/izipay-gateway";
import type { PaymentGateway } from "@/domain/payments/gateway";

/**
 * `null` = el tenant no tiene Izipay configurado — a diferencia de `resolveInvoicingGateway`, acá
 * no hay una implementación "fake" de respaldo con la misma interfaz: el checkout simplemente no
 * ofrece pago en línea y sigue con confirmación manual (`orderValidation`).
 */
export async function resolvePaymentGateway(prisma: PrismaClient, tenantId: string): Promise<PaymentGateway | null> {
  const credentials = await resolveIzipayCredentials(prisma, tenantId);
  if (!credentials) return null;
  return new IzipayPaymentGateway(credentials);
}
