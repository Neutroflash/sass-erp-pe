import { Resend } from "resend";

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Falta la variable de entorno requerida: RESEND_API_KEY");
  }
  return new Resend(apiKey);
}

const FROM = process.env.RESEND_FROM_EMAIL ?? "TuSaaS <onboarding@resend.dev>";

/**
 * Único punto de envío de correo del proyecto — cualquier email transaccional futuro (confirmación
 * de pedido, etc.) debería pasar por acá, no reimplementar su propio cliente Resend.
 */
export async function sendPasswordResetEmail(params: { to: string; recipientName: string; resetUrl: string }): Promise<void> {
  const resend = getResendClient();
  const { error } = await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: "Recupera tu contraseña",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h1 style="font-size: 18px;">Hola, ${params.recipientName}</h1>
        <p>Recibimos una solicitud para restablecer tu contraseña. Si no fuiste tú, ignora este correo.</p>
        <p>
          <a href="${params.resetUrl}" style="display: inline-block; background: #eab308; color: #000; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Restablecer contraseña
          </a>
        </p>
        <p style="color: #666; font-size: 12px;">Este enlace vence en 30 minutos. Si el botón no funciona, copia y pega este link: ${params.resetUrl}</p>
      </div>
    `,
  });

  if (error) {
    throw new Error(`No se pudo enviar el correo: ${error.message}`);
  }
}

export async function sendInvoiceEmail(params: {
  to: string;
  recipientName: string;
  businessName: string;
  invoiceLabel: string;
  pdfBuffer: Buffer;
}): Promise<void> {
  const resend = getResendClient();
  const { error } = await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `Tu comprobante ${params.invoiceLabel} — ${params.businessName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h1 style="font-size: 18px;">Hola, ${params.recipientName}</h1>
        <p>Gracias por tu compra en <strong>${params.businessName}</strong>. Adjuntamos el comprobante <strong>${params.invoiceLabel}</strong> de tu pedido.</p>
      </div>
    `,
    attachments: [{ filename: `${params.invoiceLabel}.pdf`, content: params.pdfBuffer }],
  });

  if (error) {
    throw new Error(`No se pudo enviar el correo: ${error.message}`);
  }
}

export async function sendLowStockDigestEmail(params: {
  to: string;
  recipientName: string;
  businessName: string;
  items: { sku: string; name: string; available: number; threshold: number }[];
}): Promise<void> {
  const resend = getResendClient();
  const rows = params.items
    .map(
      (i) =>
        `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee;">${i.sku}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;">${i.name}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">${i.available}</td></tr>`,
    )
    .join("");
  const { error } = await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `Stock bajo en ${params.businessName} (${params.items.length} producto${params.items.length === 1 ? "" : "s"})`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h1 style="font-size: 18px;">Hola, ${params.recipientName}</h1>
        <p>Estos productos de <strong>${params.businessName}</strong> están en o por debajo del umbral configurado:</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead><tr><th style="text-align:left;padding:4px 8px;">SKU</th><th style="text-align:left;padding:4px 8px;">Producto</th><th style="text-align:right;padding:4px 8px;">Disponible</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="color: #666; font-size: 12px; margin-top: 16px;">Cambia el umbral o desactiva este aviso desde /panel/configuracion.</p>
      </div>
    `,
  });

  if (error) {
    throw new Error(`No se pudo enviar el correo: ${error.message}`);
  }
}

export async function sendVerificationEmail(params: { to: string; recipientName: string; verifyUrl: string }): Promise<void> {
  const resend = getResendClient();
  const { error } = await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: "Confirma tu correo",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h1 style="font-size: 18px;">Hola, ${params.recipientName}</h1>
        <p>Gracias por registrar tu negocio. Confirma tu correo para terminar de activar tu cuenta.</p>
        <p>
          <a href="${params.verifyUrl}" style="display: inline-block; background: #eab308; color: #000; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Confirmar correo
          </a>
        </p>
        <p style="color: #666; font-size: 12px;">Si el botón no funciona, copia y pega este link: ${params.verifyUrl}</p>
      </div>
    `,
  });

  if (error) {
    throw new Error(`No se pudo enviar el correo: ${error.message}`);
  }
}
