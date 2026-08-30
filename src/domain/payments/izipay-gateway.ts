import { createHmac } from "crypto";
import type { CreateFormTokenParams, CreateFormTokenResult, IpnEvent, PaymentGateway } from "./gateway";

export interface IzipayCredentials {
  username: string; // identificador de tienda (Back Office Vendedor)
  password: string; // clave de Test o Producción — firma también la IPN
  publicKey: string; // viaja al frontend, no es secreta
  hmacKey: string; // HMAC-SHA-256 — reservada para validar la respuesta del cliente (no usada en el IPN)
}

const CREATE_PAYMENT_URL = "https://api.micuentaweb.pe/api-payment/V4/Charge/CreatePayment";

interface CreatePaymentApiResponse {
  status: "SUCCESS" | "ERROR";
  answer?: { formToken?: string };
}

/**
 * Implementación real contra la API REST de Izipay (plataforma "Mi Cuenta Web" / Lyra Collect,
 * la misma que documenta el SDK oficial `izipay-pe/Server-PaymentForm-Nodejs`). El formToken
 * generado acá es lo único que llega al frontend — nunca las credenciales privadas.
 */
export class IzipayPaymentGateway implements PaymentGateway {
  constructor(private readonly credentials: IzipayCredentials) {}

  async createFormToken(params: CreateFormTokenParams): Promise<CreateFormTokenResult> {
    const auth = "Basic " + Buffer.from(`${this.credentials.username}:${this.credentials.password}`).toString("base64");
    const [firstName, ...rest] = params.customerName.trim().split(/\s+/);

    const res = await fetch(CREATE_PAYMENT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify({
        amount: Math.round(params.amount * 100), // Izipay espera céntimos
        currency: "PEN",
        orderId: params.orderId,
        customer: {
          email: params.customerEmail,
          billingDetails: {
            firstName: firstName || params.customerName,
            lastName: rest.join(" ") || "-",
            phoneNumber: params.customerPhone,
            country: "PE",
          },
        },
      }),
    });

    const data = (await res.json()) as CreatePaymentApiResponse;
    if (data.status !== "SUCCESS" || !data.answer?.formToken) {
      throw new Error("Izipay no pudo generar el formToken para este pedido");
    }
    return { formToken: data.answer.formToken, publicKey: this.credentials.publicKey };
  }

  /**
   * IPN = notificación servidor-a-servidor de Izipay hacia acá. La firma se valida con la clave
   * PASSWORD (no la HMACSHA256, que es para el flujo cliente→servidor) sobre el campo `kr-answer`
   * tal cual llega, comparado contra `kr-hash` — mismo algoritmo `checkHash` del SDK oficial.
   */
  verifyAndParseIpn(rawBody: Record<string, string>): IpnEvent | null {
    const answerRaw = rawBody["kr-answer"];
    const hash = rawBody["kr-hash"];
    if (!answerRaw || !hash) return null;

    const computed = createHmac("sha256", this.credentials.password).update(answerRaw).digest("hex");
    if (computed !== hash) return null;

    try {
      const answer = JSON.parse(answerRaw) as {
        orderStatus: string;
        orderDetails: { orderId: string };
        transactions: { uuid: string }[];
      };
      return {
        orderId: answer.orderDetails.orderId,
        paid: answer.orderStatus === "PAID",
        transactionUuid: answer.transactions[0]?.uuid ?? "",
      };
    } catch {
      return null;
    }
  }
}
