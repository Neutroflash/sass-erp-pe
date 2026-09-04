/** El nombre quedó de cuando "pagada" era la única condición; hoy una venta a crédito entregada
 *  también puede facturar. Se conserva para no romper a quien lo captura por nombre. */
export class OrderNotPaidError extends Error {
  constructor(message = "Solo se puede emitir un comprobante para una orden ya entregada o pagada") {
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

export class RelatedInvoiceNotIssuedError extends Error {
  constructor(message = "Solo se puede emitir una nota contra un comprobante ya emitido ante SUNAT") {
    super(message);
    this.name = "RelatedInvoiceNotIssuedError";
  }
}

export class InvalidNoteReasonError extends Error {
  constructor(message = "El motivo de la nota no es válido para este tipo de nota") {
    super(message);
    this.name = "InvalidNoteReasonError";
  }
}
