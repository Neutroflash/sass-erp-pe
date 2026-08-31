interface TenantLegalInfo {
  businessName: string;
  ruc: string | null;
  fiscalAddress: string | null;
}

/**
 * Plantilla genérica, no asesoría legal — un punto de partida razonable para que el negocio la
 * revise/ajuste con su propio abogado (mismo criterio que Tiendanube/Shopify: dan un default
 * editable, no texto legal certificado). Interpola businessName/ruc/fiscalAddress para que nunca
 * se vea genérico a secas ni quede en blanco si el tenant no la personalizó — ver
 * Tenant.termsAndConditions en schema.prisma.
 */
export function defaultTermsAndConditions(tenant: TenantLegalInfo): string {
  const emisor = tenant.ruc ? `${tenant.businessName} (RUC ${tenant.ruc})` : tenant.businessName;
  const direccion = tenant.fiscalAddress ? ` con domicilio en ${tenant.fiscalAddress}` : "";

  return `Términos y Condiciones de ${tenant.businessName}

1. Identificación del proveedor
${emisor}${direccion} es el responsable de la venta de los productos y/o servicios ofrecidos en esta tienda en línea.

2. Aceptación de los términos
Al realizar un pedido en esta tienda, el cliente declara haber leído y aceptado estos Términos y Condiciones.

3. Precios y pagos
Los precios mostrados están expresados en Soles (S/) e incluyen los impuestos de ley aplicables, salvo indicación distinta.

4. Pedidos y confirmación
Todo pedido queda sujeto a confirmación de disponibilidad de stock y, cuando corresponda, de pago. ${tenant.businessName} se reserva el derecho de rechazar o cancelar un pedido ante indicios de fraude o error evidente de precio/stock.

5. Entrega
Los plazos y condiciones de entrega serán comunicados al cliente al momento de confirmar el pedido.

6. Cambios y devoluciones
El cliente puede ejercer su derecho de reclamo a través del Libro de Reclamaciones de esta tienda, conforme al Código de Protección y Defensa del Consumidor (Ley N° 29571).

7. Modificaciones
${tenant.businessName} podrá actualizar estos Términos y Condiciones en cualquier momento; la versión vigente es la publicada en esta página.

Última actualización: ${new Date().toLocaleDateString("es-PE")}.`;
}

export function defaultPrivacyPolicy(tenant: TenantLegalInfo): string {
  const emisor = tenant.ruc ? `${tenant.businessName} (RUC ${tenant.ruc})` : tenant.businessName;

  return `Política de Privacidad de ${tenant.businessName}

1. Responsable del tratamiento
${emisor} es responsable del tratamiento de los datos personales que el cliente proporciona al comprar o registrarse en esta tienda, conforme a la Ley N° 29733, Ley de Protección de Datos Personales, y su reglamento.

2. Datos que recopilamos
Nombre, correo electrónico, teléfono y dirección de envío, necesarios para procesar pedidos y comunicarnos con el cliente.

3. Finalidad
Los datos se usan para gestionar pedidos, emitir comprobantes electrónicos ante SUNAT, y atender consultas o reclamos.

4. No divulgación a terceros
${tenant.businessName} no vende ni cede los datos personales de sus clientes a terceros, salvo obligación legal (ej. SUNAT para la emisión de comprobantes) o el proveedor de la pasarela de pago estrictamente necesario para procesar el cobro.

5. Derechos ARCO
El cliente puede solicitar acceso, rectificación, cancelación u oposición sobre sus datos personales escribiendo a través del Libro de Reclamaciones de esta tienda.

6. Seguridad
Los datos se almacenan con medidas de seguridad razonables para prevenir accesos no autorizados.

Última actualización: ${new Date().toLocaleDateString("es-PE")}.`;
}
