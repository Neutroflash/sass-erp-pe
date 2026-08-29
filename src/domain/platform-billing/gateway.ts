export interface PlatformChargeInput {
  tenantId: string;
  amount: number;
  description: string;
}

export interface PlatformChargeResult {
  success: boolean;
  providerChargeId: string | null;
  raw: unknown;
}

/**
 * Puerto hacia quien sea que efectivamente le cobre a un tenant su suscripción — un gateway de
 * pago real (Culqi, Stripe, etc.) que ningún tenant ni la plataforma misma tiene contratado
 * todavía. Mismo tratamiento que IInvoicingGateway/InvoicingGateway en el resto del proyecto:
 * `fakePlatformPaymentGateway` (fake-gateway.ts) es la única implementación por ahora, y este
 * archivo es el único que cambiaría al conectar uno real.
 */
export interface PlatformPaymentGateway {
  charge(input: PlatformChargeInput): Promise<PlatformChargeResult>;
}
