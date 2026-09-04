/** El abono supera lo que el cliente debe. Lleva el saldo real para que la UI pueda mostrarlo. */
export class OverpaymentError extends Error {
  constructor(public readonly outstanding: number) {
    super(
      outstanding === 0
        ? "Este cliente no tiene deudas pendientes"
        : `El abono supera la deuda del cliente (saldo: S/ ${outstanding.toFixed(2)})`,
    );
    this.name = "OverpaymentError";
  }
}

export class CustomerNotFoundError extends Error {
  constructor() {
    super("Cliente no encontrado");
    this.name = "CustomerNotFoundError";
  }
}
