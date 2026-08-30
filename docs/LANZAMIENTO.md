# Pendientes para la primera versión en producción

Todo lo que sigue es trabajo **manual/externo**, no código — el código (Fases 0-5, ver `ROADMAP.md`) ya está completo y verificado. Esto es lo que falta *fuera* del repo antes de aceptar el primer negocio real.

Se divide en dos categorías distintas, porque tienen alcance distinto:

- **De la plataforma** (se hace una sola vez, nunca más): hosting, dominio, verificación del dominio de envío de correo.
- **Por cada tenant** (se repite con cada negocio nuevo que quiera facturar de verdad): certificado digital SUNAT.

## 1. Hosting — bloqueante para salir en vivo (una sola vez)

Recomendación ya cubierta en conversación previa: Vercel Pro (~US$20/mes, necesario para wildcard subdomains — el plan Hobby no soporta `*.tusaas.pe`) + Render como worker en background (~US$7/mes, `src/worker.ts` es un proceso BullMQ de larga duración, incompatible con serverless) + Neon Postgres (gratis–US$19/mes) + Upstash Redis (~US$0 a escala piloto) + dominio `.pe` (~US$30–90/año). Total estimado **US$30–60/mes**.

Sin esto no hay "primera versión" — no hay dónde correrla.

## 2. Resend — dominio de envío verificado (una sola vez)

Hoy la cuenta de Resend está en **modo sandbox**: solo entrega correos a la dirección verificada del dueño de la cuenta (confirmado en vivo durante la Fase 5 — ver `ROADMAP.md`). Password reset y verificación de email ya están construidos y funcionan, pero **no le va a llegar el correo a ningún tenant/cliente real** hasta resolver esto.

Pasos (en el dashboard de Resend, `resend.com/domains`):
1. Agregar el dominio de envío (ej. `tusaas.pe` o un subdominio como `mail.tusaas.pe`).
2. Agregar los registros DNS que Resend pide (SPF, DKIM, y opcionalmente DMARC) en el proveedor de DNS del dominio.
3. Esperar la verificación (usualmente minutos, a veces hasta 24-48h por propagación DNS).
4. Actualizar `RESEND_FROM_EMAIL` en `.env` de `TuSaaS <onboarding@resend.dev>` a la dirección real del dominio verificado (ej. `TuSaaS <no-reply@tusaas.pe>`).

No bloquea que el registro de un tenant *funcione* (el envío es best-effort, ver Fase 5.3 del roadmap), pero sin esto el flujo de verificación de email y de recuperación de contraseña son inútiles para cualquiera que no sea el dueño de la cuenta de Resend.

## 3. Certificado digital SUNAT acreditado — por cada tenant, no una sola vez

**Esto es lo que cambia respecto a lo que se dijo antes**: no es "un certificado para la plataforma". Cada comprobante se firma y se emite bajo el RUC del negocio que factura — SUNAT valida la firma contra un certificado emitido a **ese RUC específico**, así que **cada tenant que quiera facturación electrónica real necesita comprar y subir su propio certificado**, no uno que la plataforma consiga una vez para todos.

En la práctica, esto es un paso de **onboarding por negocio**, parecido a pedirle sus datos fiscales — no algo que se resuelve antes del lanzamiento y ya. El pilotazgo actual (Cliente Piloto) usa un certificado de **homologación** (autofirmado, de las credenciales públicas de prueba `MODDATOS` de SUNAT) — sirve contra `e-beta.sunat.gob.pe`, pero SUNAT en producción exige uno emitido por una entidad certificadora acreditada.

### Qué es y de dónde sale

Un certificado digital acreditado ante **INDECOPI** (la autoridad que acredita a las Entidades de Certificación bajo la Infraestructura Oficial de Firma Electrónica — IOFE). El listado oficial y actualizado de entidades acreditadas vive en el **ROPS** (Registro Oficial de Prestadores de Servicio de Certificación Digital) de INDECOPI — es la fuente a consultar en el momento real de compra, no una lista fija acá, porque puede cambiar.

Proveedores mencionados en resultados de búsqueda recientes (verificar acreditación vigente en INDECOPI antes de pagar, no tomar esto como recomendación de ninguno en particular):
- [Llama.pe](https://llama.pe/certificado-digital-para-factura-electronica-sunat)
- [Certificados.pe](https://www.certificados.pe/facturacion-electronica.html)
- [DNP Corp](https://dnp.com.pe/certificados-digitales-peru)
- Camerfirma Perú
- RENIEC también emite certificados digitales (para persona natural), aunque el uso más común para facturación electrónica de negocios es vía las entidades privadas de la lista de arriba.

La propia SUNAT tiene una página explicando el requisito: [cpe.sunat.gob.pe/certificado-digital](https://cpe.sunat.gob.pe/certificado-digital).

### Requisitos típicos para comprarlo

- Ficha RUC con código QR (no mayor a 30 días de antigüedad).
- Vigencia de poder del representante legal actualizada (no mayor a 3 meses).
- Copia de DNI vigente del representante legal.
- Validación de identidad por videollamada (WhatsApp, según el proveedor).

### Costo aproximado

Varía por vigencia — ejemplo de mercado: ~S/195 por 1 año, ~S/390 por 2 años, ~S/449 por 3 años (montos sin IGV, de un proveedor consultado; cotizar antes de asumir el precio exacto).

### Formato y cómo entra a la plataforma

SUNAT/el ecosistema de facturación electrónica peruano trabaja con certificados en formato `.pfx` (PKCS#12) — es exactamente el formato que `/panel/configuracion` (OWNER-only) ya acepta para subir credenciales SUNAT (ver Fase 3 del roadmap, `src/lib/crypto.ts` lo cifra con AES-256-GCM antes de guardarlo, nunca en claro). No hace falta cambiar código: el tenant simplemente sube su certificado real ahí en vez del de homologación.

### Implicación para el negocio (no técnica, pero importante)

Si el objetivo es lanzar con el Cliente Piloto usando facturación electrónica **real** (no homologación), ese tenant específico necesita comprar su certificado antes. Si el lanzamiento puede arrancar con otros módulos (POS/inventario/checkout) mientras el piloto sigue en homologación un tiempo más, la plataforma no bloquea — es una decisión de negocio, no técnica.

## Resumen: ¿qué bloquea el lanzamiento y qué no?

| Ítem | Bloquea lanzar la plataforma | Bloquea facturación SUNAT real de UN tenant |
|---|---|---|
| Hosting | Sí — no hay dónde correr nada | — |
| Dominio de envío en Resend | No (el registro funciona igual) | — |
| Certificado SUNAT acreditado | No (es por tenant) | Sí, para ese tenant específico |
