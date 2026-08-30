import type { PrismaClient } from "@prisma/client";
import { reserveInvoiceNumber } from "../invoicing/counter";
import { signSunatXML } from "../invoicing/sunat/sign";
import { generateDispatchGuideXML } from "./xml-builder";
import { sendDispatchGuide } from "./gre-client";
import { resolveGreCredentials } from "@/lib/gre-credentials";
import { greTicketScheduler } from "@/lib/gre-ticket-queue";
import type { DispatchGuidePayload } from "./types";

const SERIES = "T001";

export class GreNotConfiguredError extends Error {
  constructor() {
    super("Este negocio no tiene configurada la API GRE (credenciales OAuth2 + certificado SUNAT)");
    this.name = "GreNotConfiguredError";
  }
}

export interface IssueDispatchGuideParams {
  tenantId: string;
  orderId: string | null;
  destinatario: { documentTypeCode: string; documentNumber: string; name: string };
  motivoTrasladoCodigo: string;
  fechaTraslado: Date;
  pesoTotalKg: number;
  origen: { ubigeo: string; address: string };
  destino: { ubigeo: string; address: string };
  vehiculoPlaca: string;
  chofer: { documentNumber: string; firstName: string; lastName: string; license: string };
  lineas: { variantId: string | null; description: string; quantity: number; unitCode: string }[];
  emisorBusinessName: string;
}

/**
 * Mismo criterio que `issueInvoiceForOrder`: el correlativo se reserva ANTES de enviar (si el
 * envío fallara después, el número queda quemado, no se reutiliza). A diferencia de una
 * boleta/factura, el resultado del envío nunca es síncrono — `sendDispatchGuide` solo confirma
 * que SUNAT RECIBIÓ el archivo (`numTicket`); el estado real llega después, vía
 * `greTicketScheduler` + el worker (`resolve-ticket.ts`).
 */
export async function issueDispatchGuide(prisma: PrismaClient, params: IssueDispatchGuideParams) {
  const credentials = await resolveGreCredentials(prisma, params.tenantId);
  if (!credentials) throw new GreNotConfiguredError();

  const number = await reserveInvoiceNumber(prisma, params.tenantId, "GUIA_REMISION", SERIES);

  const payload: DispatchGuidePayload = {
    serie: SERIES,
    numero: number,
    fechaEmision: new Date(),
    emisor: { ruc: credentials.gre.ruc, businessName: params.emisorBusinessName },
    destinatario: params.destinatario,
    motivoTrasladoCodigo: params.motivoTrasladoCodigo,
    fechaTraslado: params.fechaTraslado,
    pesoTotalKg: params.pesoTotalKg,
    origen: params.origen,
    destino: params.destino,
    vehiculoPlaca: params.vehiculoPlaca,
    chofer: params.chofer,
    lineas: params.lineas.map((l) => ({ description: l.description, quantity: l.quantity, unitCode: l.unitCode })),
  };

  const unsignedXml = generateDispatchGuideXML(payload);
  const signedXml = signSunatXML(unsignedXml, credentials.certificate.pfxBuffer, credentials.certificate.password);

  const fileName = `${credentials.gre.ruc}-09-${SERIES}-${number}`;

  const guide = await prisma.dispatchGuide.create({
    data: {
      tenantId: params.tenantId,
      orderId: params.orderId,
      series: SERIES,
      number,
      status: "PENDING_SUNAT",
      transferReasonCode: params.motivoTrasladoCodigo,
      transferDate: params.fechaTraslado,
      grossWeightKg: params.pesoTotalKg,
      originUbigeo: params.origen.ubigeo,
      originAddress: params.origen.address,
      destinationUbigeo: params.destino.ubigeo,
      destinationAddress: params.destino.address,
      recipientDocType: params.destinatario.documentTypeCode,
      recipientDocNumber: params.destinatario.documentNumber,
      recipientName: params.destinatario.name,
      vehiclePlate: params.vehiculoPlaca,
      driverDocNumber: params.chofer.documentNumber,
      driverFirstName: params.chofer.firstName,
      driverLastName: params.chofer.lastName,
      driverLicense: params.chofer.license,
      signedXml,
      items: {
        create: params.lineas.map((l) => ({ variantId: l.variantId, description: l.description, quantity: l.quantity, unitCode: l.unitCode })),
      },
    },
    include: { items: true },
  });

  try {
    const result = await sendDispatchGuide(signedXml, credentials.gre, fileName);
    await prisma.dispatchGuide.update({ where: { id: guide.id }, data: { numTicket: result.numTicket } });
    await greTicketScheduler.schedule(guide.id);
    return { ...guide, numTicket: result.numTicket };
  } catch (err) {
    // El XML ya está firmado y el correlativo ya se reservó — si el ENVÍO falla (red, SUNAT
    // caído), la guía queda FAILED explícita en vez de silenciosamente PENDING_SUNAT sin ticket;
    // a diferencia de boletas/facturas no hay un mecanismo de "reintentar el mismo intento" para
    // GRE en este alcance v1 (emitir una guía nueva es la vía, mismo criterio que un número
    // quemado en un POS físico).
    await prisma.dispatchGuide.update({
      where: { id: guide.id },
      data: { status: "FAILED", sunatDescription: err instanceof Error ? err.message : "Error desconocido al enviar" },
    });
    throw err;
  }
}
