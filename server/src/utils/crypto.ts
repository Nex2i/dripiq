import crypto from 'crypto';

/**
 * Encryption utility for sensitive data using AES-256-GCM
 * Provides authenticated encryption with integrity verification
 */
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits for GCM
  private readonly tagLength = 16; // 128 bits authentication tag

  constructor(private readonly key: string) {
    if (!key) {
      throw new Error('Encryption key is required');
    }

    // Convert key to proper length if needed
    const keyBuffer = Buffer.from(key, 'hex');
    if (keyBuffer.length !== this.keyLength) {
      throw new Error(`Encryption key must be ${this.keyLength} bytes (256 bits) in hex format`);
    }
  }

  /**
   * Encrypt plaintext data
   * @param plaintext - The data to encrypt
   * @returns Base64 encoded encrypted data with IV and auth tag
   */
  encrypt(plaintext: string): string {
    try {
      // Generate a random IV for each encryption
      const iv = crypto.randomBytes(this.ivLength);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

      // Set additional authenticated data (empty for now)
      cipher.setAAD(Buffer.alloc(0));

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get the authentication tag
      const authTag = cipher.getAuthTag();

      // Combine: IV + Auth Tag + Encrypted Data
      const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')]);

      return combined.toString('base64');
    } catch (error) {
      throw new Error(
        `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Decrypt encrypted data
   * @param encryptedData - Base64 encoded encrypted data with IV and auth tag
   * @returns Decrypted plaintext
   */
  decrypt(encryptedData: string): string {
    try {
      // Decode the combined data
      const combined = Buffer.from(encryptedData, 'base64');

      // Extract components
      const iv = combined.subarray(0, this.ivLength);
      const authTag = combined.subarray(this.ivLength, this.ivLength + this.tagLength);
      const encrypted = combined.subarray(this.ivLength + this.tagLength);

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);
      decipher.setAAD(Buffer.alloc(0)); // Must match encryption

      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(
        `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

// Singleton instance for the service
let encryptionService: EncryptionService | null = null;

/**
 * Get the encryption service instance
 * @param key - Optional encryption key (uses env var if not provided)
 * @returns EncryptionService instance
 */
export function getEncryptionService(): EncryptionService {
  const encryptionKey = process.env.ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }

  encryptionService = new EncryptionService(encryptionKey);
  return encryptionService;
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
