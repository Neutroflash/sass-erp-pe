"use client";

import { useEffect } from "react";

const KRYPTON_SCRIPT_SRC = "https://static.micuentaweb.pe/static/js/krypton-client/V4.0/stable/kr-payment-form.min.js";

/**
 * Formulario incrustado de Izipay (SDK "Krypton", misma plataforma que documenta
 * izipay-pe/Server-PaymentForm-Nodejs) — carga el script oficial con la publicKey del tenant y el
 * formToken de este pedido puntual; Krypton escanea el DOM al cargar y "hidrata" el div
 * `.kr-embedded` con el widget real (tarjeta/Yape/Plin). `kr-post-url-success` hace que el propio
 * Krypton redirija el navegador a la confirmación tras un pago exitoso — la fuente de verdad real
 * de si se pagó sigue siendo el IPN server-a-servidor (`/api/payments/izipay/webhook`), no este
 * redirect: la página de confirmación debe tolerar llegar antes de que el IPN haya terminado de
 * procesarse.
 *
 * ⚠️ No verificado visualmente contra un formulario real — necesita credenciales de sandbox reales
 * de Izipay para probarse en un navegador (ver docs/LANZAMIENTO.md). El endpoint que genera el
 * formToken y la verificación de firma del IPN sí están verificados con criptografía real.
 */
export function IzipayCheckoutWidget({ orderId, formToken, publicKey }: { orderId: string; formToken: string; publicKey: string }) {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = KRYPTON_SCRIPT_SRC;
    script.setAttribute("kr-public-key", publicKey);
    script.setAttribute("kr-post-url-success", `${window.location.origin}/pedido/${orderId}/confirmacion`);
    script.setAttribute("kr-language", "es-PE");
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, [orderId, publicKey]);

  return (
    <div className="rounded-2xl border border-border/80 bg-white p-4">
      <div className="kr-embedded" kr-form-token={formToken} />
    </div>
  );
}
