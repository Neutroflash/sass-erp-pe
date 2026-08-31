/**
 * Datos ya resueltos para renderizar el ticket — todo lo que exige criptografía/formato oficial
 * (el "Valor Resumen" del hash, el monto en letras) se calcula en el backend, nunca en el
 * navegador: `TicketComprobante` es puramente presentacional, no reimplementa esa lógica.
 */
export interface TicketComprobanteData {
  emisor: {
    businessName: string;
    ruc: string;
    address: string;
    phone?: string;
  };
  comprobante: {
    tipo: "BOLETA" | "FACTURA";
    serie: string;
    numero: number;
    fechaEmision: string; // ISO
  };
  cliente: {
    nombre: string;
    documentoTipo: string; // "DNI" | "RUC" | "CE" | "PASAPORTE"
    documentoNumero: string;
  };
  pago: {
    forma: "CONTADO" | "CREDITO";
    /** Solo se muestra si el dato realmente se conoce — nunca se inventa un medio de pago. */
    medio?: string;
  };
  items: {
    cantidad: number;
    descripcion: string;
    precioUnitario: number;
    importe: number;
  }[];
  totales: {
    opGravada: number;
    igv: number;
    opExonerada?: number;
    opInafecta?: number;
    total: number;
    montoEnLetras: string;
  };
  /** String de 10 campos separados por "|" (Anexo N°7 de SUNAT), ya armado por el backend. */
  qrContent: string;
  /** "Valor Resumen" — mismo valor que el 10° campo de qrContent, mostrado también como texto. */
  hash: string;
}
