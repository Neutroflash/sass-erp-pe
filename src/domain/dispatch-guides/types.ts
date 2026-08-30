/**
 * Guía de Remisión Remitente — v1 solo "transporte privado" + motivo "venta" (código "01" del
 * catálogo 20). Estructura del XML (UBL DespatchAdvice, versión "2022" del formato) verificada
 * contra la plantilla oficial de Greenter (`thegreenter/xml`, librería open-source de referencia
 * para facturación electrónica peruana, la misma organización detrás del cliente REST oficial de
 * la API GRE) — no contra un envío real a SUNAT, que necesita credenciales OAuth2 de un RUC real
 * que no existen en este entorno. Ver el comentario grande en gre-client.ts.
 */
export interface DispatchGuideAddress {
  ubigeo: string; // código INEI de 6 dígitos
  address: string;
}

export interface DispatchGuideParty {
  documentTypeCode: string; // catálogo 06
  documentNumber: string;
  name: string;
}

export interface DispatchGuideDriver {
  documentNumber: string;
  firstName: string;
  lastName: string;
  license: string;
}

export interface DispatchGuideLine {
  description: string;
  quantity: number;
  unitCode: string; // catálogo 03, "NIU" = unidad por default
}

export interface DispatchGuidePayload {
  serie: string;
  numero: number;
  fechaEmision: Date;
  emisor: { ruc: string; businessName: string };
  destinatario: DispatchGuideParty;
  motivoTrasladoCodigo: string; // catálogo 20 — "01" en v1
  fechaTraslado: Date;
  pesoTotalKg: number;
  origen: DispatchGuideAddress;
  destino: DispatchGuideAddress;
  vehiculoPlaca: string;
  chofer: DispatchGuideDriver;
  lineas: DispatchGuideLine[];
}

export interface DispatchGuideSendResult {
  numTicket: string;
}

export type DispatchGuideTicketStatus =
  | { state: "PENDING" }
  | { state: "ISSUED"; cdrBase64?: string }
  | { state: "FAILED"; errorCode?: string; errorDescription?: string };
