import crypto from 'crypto';

/**
 * Encryption utility for sensitive data using AES-256-GCM
 * Provides authenticated encryption with integrity verification
 */
// ensure Buffer key, not string
class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;
  private readonly ivLength = 12; // optimal for GCM

  constructor(hexKey: string) {
    const cleaned = hexKey.trim().replace(/^['"]|['"]$/g, ''); // strip quotes
    const key = Buffer.from(cleaned, 'hex');
    if (key.length !== 32) throw new Error('Key must be 32 bytes (64 hex chars)');
    this.key = key;
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    const c1 = cipher.update(plaintext, 'utf8');
    const c2 = cipher.final();
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, c1, c2]).toString('base64');
  }

  decrypt(b64: string): string {
    const buf = Buffer.from(b64, 'base64');
    const iv = buf.subarray(0, this.ivLength);
    const tag = buf.subarray(this.ivLength, this.ivLength + 16);
    const data = buf.subarray(this.ivLength + 16);
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(tag);
    const d1 = decipher.update(data);
    const d2 = decipher.final();
    return Buffer.concat([d1, d2]).toString('utf8');
  }
}

// singleton
let svc: EncryptionService | null = null;
export function getEncryptionService(): EncryptionService {
  if (svc) return svc;
  const k = process.env.ENCRYPTION_KEY;
  if (!k) throw new Error('ENCRYPTION_KEY is required');
  svc = new EncryptionService(k);
  return svc;
}

/**
 * Convenience function to encrypt data
 * @param plaintext - Data to encrypt
 * @returns Encrypted data
 */
export function encrypt(plaintext: string): string {
  return getEncryptionService().encrypt(plaintext);
}

/**
 * Convenience function to decrypt data
 * @param encryptedData - Data to decrypt
 * @returns Decrypted data
 */
export function decrypt(encryptedData: string): string {
  return getEncryptionService().decrypt(encryptedData);
}
