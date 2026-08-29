export class OrderNotPaidError extends Error {
  constructor(message = "Solo se puede emitir un comprobante para una orden ya pagada") {
    super(message);
    this.name = "OrderNotPaidError";
  }
}

export class InvoiceAlreadyIssuedError extends Error {
  constructor(message = "Esta orden ya tiene un comprobante emitido") {
    super(message);
    this.name = "InvoiceAlreadyIssuedError";
  }
}

export class InvoicePlanLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvoicePlanLimitError";
  }
}
