import { SignedXml } from "xml-crypto";
import { parsePfx } from "./certificate";

/**
 * Firma XML-DSig (perfil enveloped, exc-c14n, SHA-256) insertada DENTRO de
 * `ext:UBLExtensions/ext:UBLExtension/ext:ExtensionContent` — no como firma enveloped genérica en
 * la raíz del documento. Esa ubicación específica es uno de los puntos donde SUNAT es más
 * estricto que el estándar XMLDSig genérico; `xml-builder.ts` deja ese nodo vacío listo para esto.
 *
 * La `Reference` cubre el documento COMPLETO (`URI=""`), con transform enveloped-signature +
 * exc-c14n antes del digest — es lo que permite que la firma siga siendo válida después de
 * insertarse a sí misma dentro del propio documento que firma.
 *
 * ⚠️ **Resultado real de una prueba en vivo contra `e-beta.sunat.gob.pe`** (con las credenciales de
 * homologación públicas de SUNAT — RUC 20000000001/MODDATOS — y un certificado autofirmado de
 * prueba, no uno emitido por una entidad certificadora acreditada): SUNAT recibió, desempaquetó y
 * procesó el SOAP/ZIP/XML sin problema — eso confirma que soap-client.ts y xml-builder.ts están
 * bien construidos — pero rechazó la firma con:
 *
 *   faultcode: soap-env:Client.2335
 *   faultstring: "El documento electrónico ingresado ha sido alterado - Detalle: Unsupported or
 *                 unrecognized Signature signer format in the message."
 *
 * Dos causas posibles, no distinguibles sin un certificado acreditado real: (a) el certificado de
 * prueba no es de una entidad certificadora reconocida por SUNAT (certeza alta, un cert real
 * resolvería esto solo), y/o (b) SUNAT exige el perfil **XAdES-BES** (un `ds:Object` con
 * `xades:QualifyingProperties/SignedProperties` — SigningTime + digest del certificado — más una
 * segunda `ds:Reference` hacia ese bloque, todo cubierto por la firma), no XMLDSig plano como está
 * implementado acá. La mayoría de integraciones SUNAT documentadas públicamente usan XAdES-BES,
 * así que (b) es la hipótesis más probable. No se implementó en este cambio: xml-crypto v6 no
 * expone un hook público para inyectar una segunda `Reference` con contenido ya calculado dentro
 * de `SignedInfo` antes de `computeSignature()` — hacerlo bien requiere construir esa parte a mano
 * con su propio canonicalizador (xml-crypto exporta `ExclusiveCanonicalization` para eso), y no
 * tiene sentido adivinarlo sin otra ronda de prueba contra beta para confirmar. Es el paso
 * siguiente concreto, no una vaguedad — ver docs/ROADMAP.md.
 */
export function signInvoiceXML(unsignedXml: string, pfxBuffer: Buffer, pfxPassword: string): string {
  const { privateKeyPem, certificateDerBase64 } = parsePfx(pfxBuffer, pfxPassword);

  const sig = new SignedXml({
    privateKey: privateKeyPem,
    signatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
    canonicalizationAlgorithm: "http://www.w3.org/2001/10/xml-exc-c14n#",
    getKeyInfoContent: () =>
      `<X509Data><X509Certificate>${certificateDerBase64}</X509Certificate></X509Data>`,
  });

  sig.addReference({
    xpath: "/*",
    transforms: ["http://www.w3.org/2000/09/xmldsig#enveloped-signature", "http://www.w3.org/2001/10/xml-exc-c14n#"],
    digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
  });

  sig.computeSignature(unsignedXml, {
    prefix: "ds",
    attrs: { Id: "SunatSignature" },
    location: {
      reference: "//*[local-name(.)='ExtensionContent']",
      action: "append",
    },
  });

  return sig.getSignedXml();
}
