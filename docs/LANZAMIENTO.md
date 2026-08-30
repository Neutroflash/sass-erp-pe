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

**Esto es lo que cambia respecto a lo que se dijo antes**: no es "un certificado para la plataforma". Cada comprobante se firma y se emite bajo el RUC del negocio que factura — SUNAT valida la firma contra un certificado emitido a **ese RUC específico**, así que **cada tenant que quiera facturación electrónica real necesita su propio certificado**, no uno que la plataforma consiga una vez para todos.

En la práctica, esto es un paso de **onboarding por negocio**, parecido a pedirle sus datos fiscales — no algo que se resuelve antes del lanzamiento y ya. El pilotazgo actual (Cliente Piloto) usa un certificado de **homologación** (autofirmado, de las credenciales públicas de prueba `MODDATOS` de SUNAT) — sirve contra `e-beta.sunat.gob.pe`, pero SUNAT en producción exige uno real.

### Opción recomendada: Certificado Digital Tributario (CDT) — gratis, directo de SUNAT

SUNAT emite su propio certificado gratuito pensado justo para este caso (negocios que arman su propio sistema de emisión, como esta plataforma) — no hace falta pagarle a una entidad certificadora privada salvo que el tenant no califique. Confirmado contra la página oficial de SUNAT (`cpe.sunat.gob.pe/certificado-digital`):

**Cómo se solicita** (lo hace el propio tenant, con su Clave SOL — no algo que la plataforma pueda tramitar por él):
1. Entrar a SOL (`sunat.gob.pe`) con RUC + Clave SOL.
2. `Empresas` → `Comprobantes de Pago` → `Certificado Digital Tributario - CDT`.
3. `Solicitar Certificado Digital Tributario`, aceptar términos y condiciones, `Enviar Solicitud`.
4. Ir al Buzón SOL, abrir el mensaje "Emisión de Certificado Digital Tributario".
5. Crear una clave privada (mínimo 8 caracteres alfanuméricos, se pide dos veces) y descargar `certificado.p12`.

**Requisitos de elegibilidad** (entre otros que SUNAT valida al momento de la solicitud):
- RUC activo y habido, afecto a renta de tercera categoría.
- Ingresos netos anuales ≤ S/ 1 260 000 (umbral 2019, el que usa la norma vigente) — pensado para MYPE, no para negocios grandes.
- No ser OSE ni PSE, no tener un CDT vigente, no haber obtenido más de dos CDT antes.

**Formato**: `.p12` (PKCS#12) — ya soportado sin cambios: `SunatCredentialsForm.tsx` acepta `.pfx,.p12` y `src/domain/invoicing/sunat/certificate.ts` lo parsea por contenido, no por extensión. El tenant sube ese archivo directo en `/panel/configuracion`.

**Vigencia y ventana de disponibilidad**: el certificado dura 3 años, pero la norma que autoriza a SUNAT a emitirlos gratis **vence el 31 de diciembre de 2027** — a tener en cuenta para el Cliente Piloto y cualquier tenant que se sume después de esa fecha (en ese punto la opción sería la ruta paga de abajo, salvo que SUNAT extienda el plazo).

**Aplicabilidad confirmada**: sirve para sistemas de emisión propios (que es exactamente cómo está construida esta plataforma — integración directa, sin PSE/OSE, ver Fase 3 del roadmap), no solo para SEE-SOL.

### Alternativa: entidad certificadora privada acreditada — para quien no califica para el CDT

Si un tenant no cumple los requisitos del CDT gratuito (factura más de S/1.26M/año, ya usó sus 2 CDT, ya es OSE/PSE, etc.), la ruta es un certificado de una **Entidad de Certificación acreditada ante INDECOPI** bajo la Infraestructura Oficial de Firma Electrónica (IOFE). El listado oficial vigente vive en el **ROPS** (Registro Oficial de Prestadores de Servicio de Certificación Digital) de INDECOPI — consultarlo al momento real de compra, no fiarse de una lista fija acá porque puede cambiar.

Proveedores que aparecen en el mercado (verificar acreditación vigente en INDECOPI antes de pagar, no es una recomendación de ninguno en particular): [Llama.pe](https://llama.pe/certificado-digital-para-factura-electronica-sunat), [Certificados.pe](https://www.certificados.pe/facturacion-electronica.html), [DNP Corp](https://dnp.com.pe/certificados-digitales-peru), Camerfirma Perú.

Requisitos típicos: ficha RUC con QR (<30 días), poder del representante legal vigente (<3 meses), DNI, validación de identidad por videollamada. Costo aproximado: ~S/195 (1 año) a ~S/449 (3 años), sin IGV, de un proveedor consultado — cotizar antes de asumir el precio exacto. Mismo formato `.pfx`/PKCS#12, mismo lugar de carga en la plataforma.

### Implicación para el negocio (no técnica, pero importante)

Si el objetivo es lanzar con el Cliente Piloto usando facturación electrónica **real** (no homologación), ese tenant específico necesita tramitar su CDT (gratis, unos minutos en SOL si califica) antes. Si el lanzamiento puede arrancar con otros módulos (POS/inventario/checkout) mientras el piloto sigue en homologación un tiempo más, la plataforma no bloquea — es una decisión de negocio, no técnica.

## 4. Cuenta comercio Izipay — por cada tenant que quiera pago en línea real

Mismo criterio que el certificado SUNAT: **por negocio, no por plataforma**. El código (`src/domain/payments/`, ver Fase 6 del roadmap) ya está construido y verificado en todo lo que no depende de la red de Izipay — falta que cada tenant que quiera cobrar tarjetas/Yape/Plin desde el checkout cree su propia cuenta comercio.

Pasos:
1. Solicitar una cuenta comercio en Izipay ([developers.izipay.pe](https://developers.izipay.pe/)) — el Back Office Vendedor entrega credenciales de **Test** (sandbox) sin costo para empezar a integrar, y credenciales de **Producción** recién al activar la cuenta comercial real (proceso comercial propio de Izipay, con sus propios requisitos de KYC/afiliación).
2. Del Back Office Vendedor: `USERNAME` (identificador de tienda), `PASSWORD`, `PUBLIC_KEY`, llave `HMAC-SHA-256` — las cuatro van en `/panel/configuracion` → "Pago en línea (Izipay)".
3. Con credenciales de **Test** cargadas, hacer una compra de prueba real en el checkout del tenant y confirmar que: el formulario embebido carga (Krypton), el pago de prueba se completa, y la orden pasa a `PAID` automáticamente (sin que el staff la confirme a mano) — esto es lo único que quedó sin poder verificarse en este entorno, exactamente por no tener una cuenta real.
4. Recién ahí, repetir con credenciales de **Producción** para cobros reales.

## 5. Credenciales OAuth2 de la API GRE — por cada tenant que quiera guías de remisión reales

Distinto de todo lo anterior: no es una cuenta con un proveedor externo, es un trámite dentro del propio SOL del tenant, pero en un menú separado del usuario/clave SOL que ya usa para facturar. El código (`src/domain/dispatch-guides/`, ver Fase 6 del roadmap) está construido y verificado en todo lo que no depende de tener esas credenciales reales — no existe, a diferencia de boletas/facturas, una cuenta pública de pruebas para esta API.

Pasos:
1. En SOL (`sunat.gob.pe`, con RUC + Clave SOL del tenant): `Empresas` → generar un `client_id`/`client_secret` para la **API GRE** (el mismo RUC que ya usa para facturar, no una cuenta aparte). El manual técnico oficial de SUNAT lo detalla: [Manual_Servicios_GRE.pdf](https://cpe.sunat.gob.pe/sites/default/files/inline-files/Manual_Servicios_GRE.pdf).
2. Cargar `client_id`/`client_secret` en `/panel/configuracion` → sección "Guías de remisión (opcional)", dentro del mismo formulario de credenciales SUNAT (hay que volver a subir el certificado y el usuario/clave SOL al guardarlo, el form siempre exige el set completo).
3. Emitir una guía de remisión de prueba real desde el detalle de un pedido y confirmar que: SUNAT recibe el envío (`numTicket`), el worker consulta el ticket y la guía pasa a `ISSUED` — esto es lo único que quedó sin poder verificarse en este entorno, exactamente por no tener credenciales reales.

## Resumen: ¿qué bloquea el lanzamiento y qué no?

| Ítem | Bloquea lanzar la plataforma | Bloquea la funcionalidad para UN tenant |
|---|---|---|
| Hosting | Sí — no hay dónde correr nada | — |
| Dominio de envío en Resend | No (el registro funciona igual) | — |
| Certificado SUNAT (CDT gratis o pago) | No (es por tenant) | Sí, factura electrónica real de ese tenant |
| Cuenta comercio Izipay | No (es por tenant, y el checkout sigue funcionando con confirmación manual sin ella) | Sí, pago en línea real (tarjetas/Yape/Plin) de ese tenant |
| Credenciales OAuth2 API GRE | No (es por tenant) | Sí, guías de remisión reales de ese tenant |
