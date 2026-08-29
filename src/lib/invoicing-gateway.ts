import { fakeInvoicingGateway } from "@/domain/invoicing/fake-gateway";
import type { InvoicingGateway } from "@/domain/invoicing/gateway";

// Único punto que cambia cuando un tenant tenga credenciales propias con un PSE real (Nubefact u
// otro) — ver el comentario en domain/invoicing/gateway.ts. Hoy siempre es el fake.
export const invoicingGateway: InvoicingGateway = fakeInvoicingGateway;
