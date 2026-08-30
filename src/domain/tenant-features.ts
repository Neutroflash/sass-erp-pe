/**
 * Matriz de módulos activos por negocio. Vive como JSON en Tenant.features (ver el comentario en
 * schema.prisma) — esta interfaz, no el `@default` de la columna, es la fuente de verdad de qué
 * pasa cuando falta una clave (tenants creados antes de que ese módulo existiera, o una fila con
 * JSON manualmente editado y roto).
 */
export interface TenantFeatures {
  /** Facturación electrónica SUNAT (boletas/facturas/notas) — ver Fase 3 del roadmap. Requiere
   * credenciales propias del negocio con su proveedor (PSE/OSE), así que se activa recién cuando
   * ese negocio las tiene configuradas — nunca por defecto. */
  sunatInvoicing: boolean;
  /** CRUD de productos/variantes/categorías + kardex. */
  inventoryManagement: boolean;
  /** Ver costPrice y el margen calculado — información sensible que un SELLER podría no deber ver
   * (ver Fase 4 del roadmap, "roles más finos"); por ahora es on/off a nivel de negocio. */
  profitMargins: boolean;
  /** Confirmar/rechazar pagos manuales (Yape/Plin) — mismo flujo que Flashkings. */
  orderValidation: boolean;
  /** Punto de venta presencial (Fase 3 del roadmap). */
  posWeb: boolean;
  /** Enviar automáticamente el PDF del comprobante al correo del cliente apenas SUNAT lo acepta
   * (BOLETA/FACTURA únicamente — mismo límite que /api/invoices/[id]/pdf, notas de crédito/débito
   * no tienen plantilla de PDF todavía). No requiere `sunatInvoicing` como precondición explícita
   * en código porque nunca dispara sin un comprobante ISSUED de por medio. */
  autoSendInvoiceEmail: boolean;
}

/**
 * Default para un negocio nuevo sin configuración explícita. inventoryManagement/profitMargins/
 * orderValidation en true porque son el producto base (sin esto no hay nada que gestionar);
 * posWeb y sunatInvoicing en false porque son módulos que un negocio activa cuando los necesita
 * (posWeb no aplica a un negocio 100% online; sunatInvoicing necesita credenciales propias que
 * todavía no tiene al registrarse) — no son "premium" en el sentido de plan pago, son
 * "actívalo cuando te sirva".
 */
export const DEFAULT_TENANT_FEATURES: TenantFeatures = {
  sunatInvoicing: false,
  inventoryManagement: true,
  profitMargins: true,
  orderValidation: true,
  posWeb: false,
  autoSendInvoiceEmail: true,
};

/**
 * Nunca confía en el JSON crudo tal cual — valida cada clave individualmente (un valor no-booleano
 * en cualquier campo, o una clave ausente, cae al default de ESA clave puntual) en vez de asumir
 * que el objeto entero es válido solo porque no es null. Esto es lo que hace seguro agregar un
 * módulo nuevo a la interfaz sin tener que migrar todas las filas existentes.
 */
export function parseTenantFeatures(raw: unknown): TenantFeatures {
  const source = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const result = {} as TenantFeatures;

  for (const key of Object.keys(DEFAULT_TENANT_FEATURES) as (keyof TenantFeatures)[]) {
    const value = source[key];
    result[key] = typeof value === "boolean" ? value : DEFAULT_TENANT_FEATURES[key];
  }

  return result;
}
