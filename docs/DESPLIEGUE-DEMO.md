# Despliegue de una demo para un cliente

Cómo poner el panel de un negocio en línea para que un cliente lo pruebe solo, antes de firmar
nada. Costo: **cero**.

No es el despliegue de la plataforma completa que describe `LANZAMIENTO.md` — ese necesita
subdominios comodín (`*.flashstock.pe`), que obligan a un plan pago. Para **un** cliente viendo
**un** negocio hay un camino mucho más corto.

## La idea

`Tenant.customDomain` es un lookup directo contra la base (ver `src/app/api/resolve-domain/`).
Asignándole a mano el hostname que da el hosting, esa URL abre directo el panel de ese negocio:
sin DNS propio, sin dominio comprado, sin comodines.

Efecto secundario que conviene: como la URL mapea a un tenant, el cliente **nunca ve** el sitio de
marketing, ni `/registro`, ni el panel de plataforma — `admin.` no resuelve a nada.

## Cuentas

| Servicio | Para | Plan |
|---|---|---|
| [Neon](https://neon.tech) | Postgres | Free |
| [Upstash](https://upstash.com) | Redis | Free |
| [Vercel](https://vercel.com) | Hosting | Hobby |

> **Ojo con Vercel Hobby**: sus términos prohíben uso comercial. Para una demo es zona gris; el día
> que el cliente pague hay que pasar a Pro u otro hosting.

## Variables de entorno

Los secretos se generan nuevos, nunca se reutilizan los de desarrollo:

```bash
openssl rand -hex 32   # una para cada JWT_* y para CERT_ENCRYPTION_KEY
```

```
DATABASE_URL                     de Neon
REDIS_URL                        de Upstash
JWT_TENANT_ACCESS_SECRET         generada
JWT_TENANT_REFRESH_SECRET        generada
JWT_PLATFORM_ACCESS_SECRET       generada
JWT_PLATFORM_REFRESH_SECRET      generada
CERT_ENCRYPTION_KEY              generada  ← ver la advertencia abajo
ROOT_DOMAIN                      flashstock.pe
NEXT_PUBLIC_ROOT_DOMAIN          flashstock.pe
RESEND_API_KEY                   la de siempre
RESEND_FROM_EMAIL                la de siempre
STOCK_HOLD_MINUTES               15
PASSWORD_RESET_TOKEN_TTL_MINUTES 30
SUNAT_RETRY_MAX_ATTEMPTS         5
```

`RUNTIME_DATABASE_URL` se puede omitir en una demo: sin ella la app cae a `DATABASE_URL` y las
políticas RLS quedan inertes (ver `docs/RLS.md`). Con un solo negocio no cambia nada — antes de que
entre un segundo cliente, hay que crear el rol en Neon y agregarla.

## Pasos

1. Crear las tres cuentas y copiar `DATABASE_URL` y `REDIS_URL`.
2. Importar el repo en Vercel y pegar las variables.
3. Desplegar. `vercel.json` ya trae el build command con las migraciones.
4. Sembrar y configurar, desde tu máquina, apuntando a la base de producción:

```bash
DATABASE_URL="postgresql://...neon..." bun run prisma:seed

DATABASE_URL="postgresql://...neon..." \
CERT_ENCRYPTION_KEY="la-misma-de-Vercel" \
DEMO_DOMAIN="tu-app.vercel.app" \
DEMO_PFX_PATH="$HOME/flashstock-credenciales/homologacion.pfx" \
DEMO_PFX_PASSWORD="..." \
bun run scripts/setup-demo.ts
```

`setup-demo.ts` deja el dominio, los módulos, el inventario de demostración y el certificado.
Es idempotente: correrlo dos veces no duplica nada.

5. Entrar, hacer una venta y emitir una boleta de prueba. Debe volver `ISSUED`.
6. Mandarle al cliente la URL y `owner@piloto.pe` / `Piloto123!`.

## Certificado de homologación

Contra `e-beta.sunat.gob.pe` **no hace falta un certificado acreditado**: SUNAT beta valida la
estructura de la firma, no la cadena de confianza. Uno autofirmado alcanza:

```bash
openssl req -x509 -newkey rsa:2048 -sha256 -days 1825 -nodes \
  -keyout tmp.key -out tmp.crt \
  -subj "/C=PE/ST=Lima/L=Lima/O=EMPRESA DE PRUEBA MODDATOS/OU=FlashStock/CN=20000000001"
openssl pkcs12 -export -out homologacion.pfx -inkey tmp.key -in tmp.crt -passout pass:TU_CLAVE
rm tmp.key tmp.crt
```

`CN=20000000001` es el RUC de la cuenta SOL pública de pruebas (`MODDATOS` / `moddatos`), que
`setup-demo.ts` carga automáticamente.

**Verificado**: con un certificado generado así, SUNAT beta aceptó boleta sin identificar al
comprador, boleta 100% exonerada y factura con afectaciones mixtas.

## Tres cosas que muerden

**Las migraciones no corren solas.** `start` es `prisma migrate deploy && next start`, pero Vercel
nunca ejecuta `start` — es serverless. Por eso el build command de `vercel.json` las incluye. Sin
eso, la base queda sin esquema.

**`CERT_ENCRYPTION_KEY` es de una sola vez.** Cifra el `.pfx` en la base. Si cambia, el certificado
guardado se vuelve indescifrable y hay que volver a subirlo. Generala y guardala.

**Sin worker no hay reintentos automáticos a SUNAT.** El worker es un proceso de larga duración y
no corre en Vercel; desplegarlo obliga a pagar un segundo hosting, que para una demo no se
justifica. Si SUNAT está caído al emitir, el comprobante queda `PENDING_SUNAT` hasta que alguien
use el botón de reintento en `/panel/facturacion`. También quedan sin correr la expiración de
reservas del checkout online, el aviso de stock bajo y el cobro de suscripciones — nada de eso hace
falta para probar inventario, POS y crédito.

## Lo que el cliente tiene que saber

Los comprobantes de la demo salen contra `e-beta.sunat.gob.pe`: **son de ensayo y no tienen validez
ante SUNAT**. Si el cliente cree que está emitiendo boletas reales y deja de declarar ventas por su
sistema actual, el problema es serio. Decírselo explícito antes de que toque el botón, no solo en
el contrato.
