import forge from "node-forge";

export interface ParsedCertificate {
  certificatePem: string;
  privateKeyPem: string;
  /** DER en base64, sin cabeceras PEM — es lo que va dentro de <ds:X509Certificate>. */
  certificateDerBase64: string;
  /** DER crudo — lo que se hashea para <xades:CertDigest> (XAdES-BES). */
  certificateDer: Buffer;
  /** Emisor en formato "CN=...,O=...,C=..." — best-effort, ver el comentario en xades.ts sobre
   * por qué este campo pesa menos que CertDigest en la validación real. */
  issuerName: string;
  /** Número de serie en decimal (X509SerialNumber de XAdES lo exige así, no en hex). */
  serialNumberDecimal: string;
}

/** Compara el módulo RSA del certificado con el de la clave privada: es la única prueba real de
 *  que ese certificado es el del titular y no un eslabón de la cadena. */
function matchesPrivateKey(cert: forge.pki.Certificate, key: forge.pki.PrivateKey): boolean {
  const pub = cert.publicKey as forge.pki.rsa.PublicKey | undefined;
  const priv = key as forge.pki.rsa.PrivateKey;
  if (!pub?.n || !priv?.n) return false;
  return pub.n.compareTo(priv.n) === 0;
}

/** Respaldo para certificados que no son RSA: PKCS#12 empareja clave y certificado con el mismo
 *  `localKeyId`. */
function sameLocalKeyId(certBag: forge.pkcs12.Bag, keyBag: forge.pkcs12.Bag): boolean {
  const a = certBag.attributes?.localKeyId?.[0];
  const b = keyBag.attributes?.localKeyId?.[0];
  return Boolean(a && b && a === b);
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

  // Algunos emisores guardan la clave cifrada (pkcs8ShroudedKeyBag) y otros en claro (keyBag).
  const keyBags =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ??
    p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag];
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag];

  const keyBag = keyBags?.[0];
  if (!keyBag?.key || !certBags?.length) {
    throw new Error("El archivo .pfx no contiene una clave privada y un certificado válidos, o la contraseña es incorrecta");
  }

  // El certificado del titular es el que corresponde a la clave privada, no "el primero".
  //
  // Un certificado de homologación es autofirmado: un solo certificado en el archivo, y tomar
  // `certBags[0]` acertaba siempre. Uno acreditado de verdad viene con su cadena — hoja,
  // intermedia y raíz — en un orden que nadie garantiza. Firmar con la intermedia produce un
  // rechazo de SUNAT recién al emitir, con el correlativo ya quemado.
  const certBag =
    certBags.find((bag) => bag.cert && matchesPrivateKey(bag.cert, keyBag.key!)) ??
    certBags.find((bag) => sameLocalKeyId(bag, keyBag));

  if (!certBag?.cert) {
    throw new Error(
      "El archivo .pfx no contiene ningún certificado que corresponda a su clave privada. " +
        "Si viene con la cadena de la entidad certificadora, exporta el certificado del titular junto con su clave.",
    );
  }

  const privateKeyPem = forge.pki.privateKeyToPem(keyBag.key);
  const certificatePem = forge.pki.certificateToPem(certBag.cert);
  const derBytes = forge.asn1.toDer(forge.pki.certificateToAsn1(certBag.cert)).getBytes();
  const certificateDer = Buffer.from(derBytes, "binary");
  const certificateDerBase64 = forge.util.encode64(derBytes);

  // RFC2253-ish, orden inverso al de forge (que lista del más general al más específico) — best
  // effort: distintos emisores usan atributos distintos y el orden exacto no está 100%
  // estandarizado entre implementaciones. El campo que SUNAT valida criptográficamente de verdad
  // es CertDigest (el hash del certificado), no este texto descriptivo.
  const issuerName = certBag.cert.issuer.attributes
    .slice()
    .reverse()
    .map((attr) => `${attr.shortName ?? attr.name}=${attr.value}`)
    .join(",");

  const serialNumberDecimal = BigInt(`0x${certBag.cert.serialNumber}`).toString(10);

  return { certificatePem, privateKeyPem, certificateDerBase64, certificateDer, issuerName, serialNumberDecimal };
}
