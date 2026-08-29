import forge from "node-forge";

export interface ParsedCertificate {
  certificatePem: string;
  privateKeyPem: string;
  /** DER en base64, sin cabeceras PEM — es lo que va dentro de <ds:X509Certificate>. */
  certificateDerBase64: string;
}

/**
 * Extrae la clave privada y el certificado de un .pfx/.p12 (formato estándar en el que SUNAT y
 * las entidades certificadoras peruanas entregan el certificado digital de un contribuyente).
 * node-forge es la única dependencia que toca el archivo crudo — nunca se persiste ni se loguea
 * el contenido descifrado, solo se mantiene en memoria durante la firma de un comprobante puntual.
 */
export function parsePfx(pfxBuffer: Buffer, password: string): ParsedCertificate {
  const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfxBuffer.toString("binary")));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag];
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag];

  const keyBag = keyBags?.[0];
  const certBag = certBags?.[0];
  if (!keyBag?.key || !certBag?.cert) {
    throw new Error("El archivo .pfx no contiene una clave privada y un certificado válidos, o la contraseña es incorrecta");
  }

  const privateKeyPem = forge.pki.privateKeyToPem(keyBag.key);
  const certificatePem = forge.pki.certificateToPem(certBag.cert);
  const certificateDerBase64 = forge.util.encode64(forge.asn1.toDer(forge.pki.certificateToAsn1(certBag.cert)).getBytes());

  return { certificatePem, privateKeyPem, certificateDerBase64 };
}
