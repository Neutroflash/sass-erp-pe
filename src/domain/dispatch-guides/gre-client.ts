import { createHash } from "crypto";
import { zipXml } from "../invoicing/sunat/soap-client";
import type { DispatchGuideSendResult, DispatchGuideTicketStatus } from "./types";

/**
 * ⚠️ NADA en este archivo está confirmado contra la API real de SUNAT — a diferencia del resto de
 * la integración SUNAT de este proyecto (boletas/facturas/notas, todas confirmadas en vivo contra
 * `e-beta.sunat.gob.pe`), la API GRE **no tiene una cuenta pública de pruebas** como `MODDATOS`:
 * necesita un `client_id`/`client_secret` generado en el menú SOL de un RUC real, algo que no
 * existe en este entorno de desarrollo. Los endpoints, payloads y algoritmos de acá están
 * reconstruidos contra la especificación OpenAPI oficial (`thegreenter/gre-api`, el mismo
 * proveedor open-source detrás del manual técnico que enlaza SUNAT), no inventados — pero "bien
 * transcritos" no es lo mismo que "verificados en vivo". Ver docs/LANZAMIENTO.md.
 */

const AUTH_URL = (clientId: string) => `https://api-seguridad.sunat.gob.pe/v1/clientessol/${clientId}/oauth2/token/`;
const SEND_URL = (filename: string) => `https://api-cpe.sunat.gob.pe/v1/contribuyente/gem/comprobantes/${filename}`;
const STATUS_URL = (numTicket: string) => `https://api-cpe.sunat.gob.pe/v1/contribuyente/gem/comprobantes/envios/${numTicket}`;

export interface GreCredentials {
  ruc: string;
  solUser: string;
  solPassword: string;
  clientId: string;
  clientSecret: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/** Grant type "password" (no client_credentials) — la API GRE exige usuario+clave SOL además del
 * par client_id/client_secret, no reemplaza uno por el otro. */
async function getAccessToken(credentials: GreCredentials): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "password",
    scope: "https://api-cpe.sunat.gob.pe",
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    username: `${credentials.ruc}${credentials.solUser}`,
    password: credentials.solPassword,
  });

  const res = await fetch(AUTH_URL(credentials.clientId), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`SUNAT rechazó las credenciales OAuth2 de la API GRE (HTTP ${res.status})`);
  }
  const data = (await res.json()) as TokenResponse;
  return data.access_token;
}

/**
 * Envía la guía firmada — a diferencia de `sendToSunat` (SOAP, síncrono), esto solo confirma que
 * SUNAT RECIBIÓ el archivo (`numTicket`); el resultado real (aceptado/rechazado) se consulta
 * después con `checkTicketStatus` — ver `lib/gre-ticket-queue.ts`.
 */
export async function sendDispatchGuide(
  signedXml: string,
  credentials: GreCredentials,
  fileNameWithoutExtension: string,
): Promise<DispatchGuideSendResult> {
  const token = await getAccessToken(credentials);
  const zipBuffer = await zipXml(`${fileNameWithoutExtension}.xml`, signedXml);
  const hashZip = createHash("sha256").update(zipBuffer).digest("hex");

  const res = await fetch(SEND_URL(fileNameWithoutExtension), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      archivo: {
        nomArchivo: `${fileNameWithoutExtension}.zip`,
        arcGreZip: zipBuffer.toString("base64"),
        hashZip,
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`SUNAT rechazó el envío de la guía (HTTP ${res.status}): ${errBody}`);
  }

  const data = (await res.json()) as { numTicket: string };
  return { numTicket: data.numTicket };
}

/** `codRespuesta`: "98" en proceso, "99" envío con error, "0" envío OK (CDR generado). */
export async function checkTicketStatus(numTicket: string, credentials: GreCredentials): Promise<DispatchGuideTicketStatus> {
  const token = await getAccessToken(credentials);
  const res = await fetch(STATUS_URL(numTicket), {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`No se pudo consultar el estado del ticket ${numTicket} (HTTP ${res.status})`);
  }

  const data = (await res.json()) as {
    codRespuesta: string;
    error?: { numError: string; desError: string };
    arcCdr?: string;
  };

  if (data.codRespuesta === "98") return { state: "PENDING" };
  if (data.codRespuesta === "0") return { state: "ISSUED", cdrBase64: data.arcCdr };
  return { state: "FAILED", errorCode: data.error?.numError, errorDescription: data.error?.desError };
}
