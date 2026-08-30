export interface CreateFormTokenParams {
  orderId: string;
  amount: number; // soles, no céntimos — el gateway concreto convierte si lo necesita
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
}

export interface CreateFormTokenResult {
  formToken: string;
  publicKey: string;
}

export interface IpnEvent {
  orderId: string;
  paid: boolean;
  transactionUuid: string;
}

/**
 * Puerto de pasarela de pago real — mismo criterio que `InvoicingGateway` (domain/invoicing/gateway.ts):
 * el dominio nunca conoce el proveedor concreto (Izipay hoy, podría ser Culqi/otro mañana), solo
 * esta forma. A diferencia de la facturación, acá NO hay un "gateway fake" con la misma interfaz —
 * un tenant sin credenciales configuradas simplemente no ofrece pago en línea (sigue con
 * confirmación manual, `orderValidation`), no simula un pago exitoso.
 */
export interface PaymentGateway {
  createFormToken(params: CreateFormTokenParams): Promise<CreateFormTokenResult>;
  /** `null` si la firma no valida — nunca confiar en un payload de IPN sin verificar primero. */
  verifyAndParseIpn(rawBody: Record<string, string>): IpnEvent | null;
}
