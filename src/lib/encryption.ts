import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // bytes — padrão recomendado para GCM

/**
 * Criptografa uma string usando AES-256-GCM.
 * A ENCRYPTION_KEY deve ter exatamente 32 bytes (256 bits).
 *
 * @param plaintext - Texto puro a ser criptografado
 * @returns - String no formato "iv:authTag:encryptedData" (hex)
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':');
}

/**
 * Descriptografa uma string gerada por `encrypt`.
 *
 * @param ciphertext - String no formato "iv:authTag:encryptedData" (hex)
 * @returns - Texto puro original
 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const parts = ciphertext.split(':');

  if (parts.length !== 3) {
    throw new Error('Formato de ciphertext inválido.');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Retorna a chave de criptografia derivada da variável de ambiente.
 * A chave é normalizada para exatamente 32 bytes via Buffer.
 * Lança um erro se a variável não estiver definida.
 *
 * @returns Buffer
 */
function getEncryptionKey(): Buffer {
  const rawKey = process.env.ENCRYPTION_KEY;

  if (!rawKey) {
    throw new Error('[encryption] ENCRYPTION_KEY não definida nas variáveis de ambiente.');
  }

  // Suporte a chaves hex (64 chars) ou string UTF-8 (padding/truncate para 32 bytes)
  if (rawKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawKey)) {
    return Buffer.from(rawKey, 'hex');
  }

  // Normaliza para exatamente 32 bytes
  const keyBuffer = Buffer.alloc(32);
  Buffer.from(rawKey, 'utf8').copy(keyBuffer);
  return keyBuffer;
}
