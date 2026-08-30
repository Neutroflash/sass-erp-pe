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
