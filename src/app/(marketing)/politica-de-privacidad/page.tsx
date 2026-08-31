import type { Metadata } from "next";

export const metadata: Metadata = { title: "Política de Privacidad | FlashStock" };

export default function PoliticaPrivacidadPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Política de Privacidad</h1>
      <div className="flex flex-col gap-5 text-sm leading-relaxed text-muted-foreground">
        <p>
          FlashStock es responsable del tratamiento de los datos personales que recopila, conforme a la Ley N° 29733, Ley de
          Protección de Datos Personales, y su reglamento.
        </p>

        <div>
          <h2 className="mb-1 font-semibold text-foreground">1. Datos que recopilamos</h2>
          <p>
            Del dueño/staff del Negocio que se registra: nombre, correo, teléfono y datos fiscales (RUC, dirección) del negocio
            que administra. FlashStock no accede a los datos personales de los clientes finales de cada Negocio salvo para operar
            la infraestructura técnica (envío de comprobantes, hospedaje de la base de datos) — esos datos son responsabilidad del
            Negocio frente a sus propios clientes.
          </p>
        </div>

        <div>
          <h2 className="mb-1 font-semibold text-foreground">2. Finalidad</h2>
          <p>Gestionar la cuenta y suscripción del Negocio, procesar cobros, enviar comunicaciones sobre el servicio, y brindar soporte técnico.</p>
        </div>

        <div>
          <h2 className="mb-1 font-semibold text-foreground">3. Certificados y credenciales SUNAT/pasarela de pago</h2>
          <p>
            El Certificado Digital, las credenciales SOL y las credenciales de la pasarela de pago que cada Negocio configura se
            almacenan cifradas (AES-256-GCM) — FlashStock nunca las expone en texto plano, ni siquiera a su propio equipo.
          </p>
        </div>

        <div>
          <h2 className="mb-1 font-semibold text-foreground">4. No divulgación a terceros</h2>
          <p>
            FlashStock no vende ni cede datos personales a terceros, salvo obligación legal (ej. SUNAT) o los proveedores
            estrictamente necesarios para operar el servicio (hosting, envío de correo, procesamiento de pagos de la suscripción).
          </p>
        </div>

        <div>
          <h2 className="mb-1 font-semibold text-foreground">5. Derechos ARCO</h2>
          <p>
            Puedes solicitar acceso, rectificación, cancelación u oposición sobre tus datos personales a través del{" "}
            <a href="/libro-de-reclamaciones" className="text-yellow-400 hover:underline">
              Libro de Reclamaciones
            </a>
            .
          </p>
        </div>

        <p className="text-xs text-muted-foreground/70">Última actualización: {new Date().toLocaleDateString("es-PE")}.</p>
      </div>
    </div>
  );
}
