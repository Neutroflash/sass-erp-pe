import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits, tamaño recomendado para GCM
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const hex = process.env.CERT_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error("Falta la variable de entorno requerida: CERT_ENCRYPTION_KEY");
  }
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error("CERT_ENCRYPTION_KEY debe ser 32 bytes en hex (64 caracteres) — generar con `openssl rand -hex 32`");
  }
  return key;
}

/**
 * Cifrado simétrico de material sensible en reposo (certificado digital .pfx, clave SOL) — nunca
 * se persiste texto plano de ninguna de las dos en la base de datos. Formato del buffer resultante:
 * [iv(12) | authTag(16) | ciphertext]. En producción real, `CERT_ENCRYPTION_KEY` debería vivir en
 * un KMS/secret manager (AWS KMS, GCP Secret Manager) con rotación, no en una env var plana como
 * el resto de los secrets de este proyecto — se documenta acá porque es la diferencia real entre
 * este campo y, por ejemplo, JWT_TENANT_ACCESS_SECRET: ese protege sesiones que expiran en minutos,
 * esto protege un certificado que puede firmar documentos tributarios en nombre de un tercero real
 * durante años.
 */
export function encryptSecret(plaintext: Buffer): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]);
}

export function decryptSecret(encrypted: Buffer): Buffer {
  const iv = encrypted.subarray(0, IV_LENGTH);
  const authTag = encrypted.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = encrypted.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function encryptSecretString(plaintext: string): Buffer {
  return encryptSecret(Buffer.from(plaintext, "utf8"));
}

export function decryptSecretString(encrypted: Buffer): string {
  return decryptSecret(encrypted).toString("utf8");
}
