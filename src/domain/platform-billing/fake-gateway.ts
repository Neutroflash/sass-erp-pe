import { randomUUID } from "crypto";
import type { PlatformChargeInput, PlatformChargeResult, PlatformPaymentGateway } from "./gateway";

// Ningún gateway de pago real está conectado todavía (Culqi/Stripe u otro) — mismo estado que
// InvoicingGateway antes de SUNAT. Siempre "cobra" con éxito; no hay un caso de negocio real que
// probar contra un fallo del proveedor todavía.
export const fakePlatformPaymentGateway: PlatformPaymentGateway = {
  async charge(input: PlatformChargeInput): Promise<PlatformChargeResult> {
    return {
      success: true,
      providerChargeId: `fake_${randomUUID()}`,
      raw: { fake: true, tenantId: input.tenantId, amount: input.amount, description: input.description },
    };
  },
};
