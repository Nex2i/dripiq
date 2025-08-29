# TICKET-008: Create Provider Configuration Repository

## **Priority:** High
## **Estimated Time:** 2-3 days
## **Phase:** 3 - Database Schema Changes
## **Dependencies:** TICKET-007

---

## **Description**
Create repository classes for managing email provider configurations and OAuth tokens. These repositories will handle CRUD operations, credential encryption/decryption, and provide query methods needed by the provider factory.

## **Acceptance Criteria**

### **Must Have**
- [ ] Create `EmailProviderConfigRepository` class with CRUD operations
- [ ] Create `EmailProviderTokenRepository` class for OAuth token management
- [ ] Implement credential encryption/decryption
- [ ] Add query methods for provider factory integration
- [ ] Include tenant isolation and security
- [ ] Support default provider management

### **Should Have**
- [ ] Implement caching for frequently accessed configs
- [ ] Add bulk operations for efficiency
- [ ] Include configuration validation
- [ ] Support soft delete operations

### **Could Have**
- [ ] Add configuration versioning
- [ ] Implement audit logging
- [ ] Support configuration templates

## **Technical Requirements**

### **Primary Repository: EmailProviderConfigRepository**
**File:** `server/src/repositories/entities/EmailProviderConfigRepository.ts`

```typescript
import { eq, and, desc } from 'drizzle-orm';
import { TenantAwareRepository } from '../TenantAwareRepository';
import { 
  emailProviderConfigs, 
  type EmailProviderConfig, 
  type NewEmailProviderConfig 
} from '@/db/schema';
import type { ProviderConfig, EmailProviderType } from '@/libs/email/types/EmailConfig.types';
import { CredentialEncryption } from '@/libs/security/CredentialEncryption';
import { logger } from '@/libs/logger';

export class EmailProviderConfigRepository extends TenantAwareRepository<
  typeof emailProviderConfigs,
  EmailProviderConfig,
  NewEmailProviderConfig
> {
  private encryption = new CredentialEncryption();
  
  constructor() {
    super(emailProviderConfigs);
  }

  /**
   * Create a new provider configuration with encrypted credentials
   */
  async createForTenant(
    tenantId: string,
    data: Omit<NewEmailProviderConfig, 'tenantId'> & { 
      credentials?: Record<string, any> 
    }
  ): Promise<EmailProviderConfig> {
    const { credentials, ...configData } = data;
    
    // Encrypt credentials if provided
    const encryptedCredentials = credentials 
      ? await this.encryption.encrypt(JSON.stringify(credentials), tenantId)
      : undefined;

    const providerConfig = {
      ...configData,
      tenantId,
      encryptedCredentials,
    } as NewEmailProviderConfig;

    // If this is being set as default, unset other defaults first
    if (providerConfig.isDefault) {
      await this.unsetDefaultForTenant(tenantId);
    }

    const result = await this.db.insert(this.table).values(providerConfig).returning();
    
    logger.info('[EmailProviderConfigRepository] Provider config created', {
      tenantId,
      configId: result[0]?.id,
      type: configData.type,
      name: configData.name,
      isDefault: configData.isDefault,
    });

    return result[0] as EmailProviderConfig;
  }

  /**
   * Get provider configuration with decrypted credentials
   */
  async findByIdWithCredentials(
    id: string, 
    tenantId: string
  ): Promise<(EmailProviderConfig & { credentials?: Record<string, any> }) | undefined> {
    const config = await this.findByIdForTenant(id, tenantId);
    
    if (!config) {
      return undefined;
    }

    return this.addDecryptedCredentials(config, tenantId);
  }

  /**
   * Find default provider configuration for tenant
   */
  async findDefaultForTenant(tenantId: string): Promise<EmailProviderConfig | undefined> {
    const result = await this.db
      .select()
      .from(this.table)
      .where(
        and(
          eq(this.table.tenantId, tenantId),
          eq(this.table.isDefault, true),
          eq(this.table.isActive, true)
        )
      )
      .limit(1);

    return result[0] as EmailProviderConfig | undefined;
  }

  /**
   * Find default provider with credentials
   */
  async findDefaultForTenantWithCredentials(
    tenantId: string
  ): Promise<(EmailProviderConfig & { credentials?: Record<string, any> }) | undefined> {
    const config = await this.findDefaultForTenant(tenantId);
    
    if (!config) {
      return undefined;
    }

    return this.addDecryptedCredentials(config, tenantId);
  }

  /**
   * Find provider by name for tenant
   */
  async findByNameForTenant(
    name: string, 
    tenantId: string
  ): Promise<EmailProviderConfig | undefined> {
    const result = await this.db
      .select()
      .from(this.table)
      .where(
        and(
          eq(this.table.tenantId, tenantId),
          eq(this.table.name, name),
          eq(this.table.isActive, true)
        )
      )
      .limit(1);

    return result[0] as EmailProviderConfig | undefined;
  }

  /**
   * Find provider by name with credentials
   */
  async findByNameForTenantWithCredentials(
    name: string, 
    tenantId: string
  ): Promise<(EmailProviderConfig & { credentials?: Record<string, any> }) | undefined> {
    const config = await this.findByNameForTenant(name, tenantId);
    
    if (!config) {
      return undefined;
    }

    return this.addDecryptedCredentials(config, tenantId);
  }

  /**
   * Find all active providers for tenant
   */
  async findActiveForTenant(tenantId: string): Promise<EmailProviderConfig[]> {
    return (await this.db
      .select()
      .from(this.table)
      .where(
        and(
          eq(this.table.tenantId, tenantId),
          eq(this.table.isActive, true)
        )
      )
      .orderBy(desc(this.table.isDefault), this.table.name)) as EmailProviderConfig[];
  }

  /**
   * Find all providers by type for tenant
   */
  async findByTypeForTenant(
    type: EmailProviderType, 
    tenantId: string
  ): Promise<EmailProviderConfig[]> {
    return (await this.db
      .select()
      .from(this.table)
      .where(
        and(
          eq(this.table.tenantId, tenantId),
          eq(this.table.type, type),
          eq(this.table.isActive, true)
        )
      )
      .orderBy(desc(this.table.isDefault), this.table.name)) as EmailProviderConfig[];
  }

  /**
   * Set a provider as default (unsets others)
   */
  async setDefault(configId: string, tenantId: string): Promise<EmailProviderConfig | undefined> {
    // First, unset all defaults for this tenant
    await this.unsetDefaultForTenant(tenantId);

    // Then set the new default
    const result = await this.db
      .update(this.table)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(
        and(
          eq(this.table.id, configId),
          eq(this.table.tenantId, tenantId)
        )
      )
      .returning();

    const updated = result[0] as EmailProviderConfig | undefined;

    if (updated) {
      logger.info('[EmailProviderConfigRepository] Default provider updated', {
        tenantId,
        configId,
        type: updated.type,
        name: updated.name,
      });
    }

    return updated;
  }

  /**
   * Update provider configuration
   */
  async updateWithCredentials(
    configId: string,
    tenantId: string,
    updates: Partial<Omit<NewEmailProviderConfig, 'tenantId'>> & { 
      credentials?: Record<string, any> 
    }
  ): Promise<EmailProviderConfig | undefined> {
    const { credentials, ...configUpdates } = updates;
    
    let encryptedCredentials: string | undefined;
    
    // Handle credential updates
    if (credentials !== undefined) {
      if (credentials === null) {
        encryptedCredentials = null as any; // Clear credentials
      } else {
        encryptedCredentials = await this.encryption.encrypt(
          JSON.stringify(credentials), 
          tenantId
        );
      }
    }

    const updateData = {
      ...configUpdates,
      ...(encryptedCredentials !== undefined && { encryptedCredentials }),
      updatedAt: new Date(),
    } as Partial<NewEmailProviderConfig>;

    // If setting as default, unset others first
    if (updateData.isDefault) {
      await this.unsetDefaultForTenant(tenantId);
    }

    const result = await this.db
      .update(this.table)
      .set(updateData)
      .where(
        and(
          eq(this.table.id, configId),
          eq(this.table.tenantId, tenantId)
        )
      )
      .returning();

    return result[0] as EmailProviderConfig | undefined;
  }

  /**
   * Soft delete (deactivate) a provider configuration
   */
  async deactivateForTenant(configId: string, tenantId: string): Promise<boolean> {
    const result = await this.db
      .update(this.table)
      .set({ 
        isActive: false, 
        isDefault: false, // Can't be default if inactive
        updatedAt: new Date() 
      })
      .where(
        and(
          eq(this.table.id, configId),
          eq(this.table.tenantId, tenantId)
        )
      )
      .returning();

    const wasDeactivated = result.length > 0;

    if (wasDeactivated) {
      logger.info('[EmailProviderConfigRepository] Provider config deactivated', {
        tenantId,
        configId,
      });
    }

    return wasDeactivated;
  }

  /**
   * Find provider config for a specific sender identity
   */
  async findForSenderIdentity(
    senderIdentityId: string,
    tenantId: string
  ): Promise<EmailProviderConfig | undefined> {
    // Join with email_sender_identities to find the associated provider
    const result = await this.db
      .select({
        config: this.table,
      })
      .from(this.table)
      .innerJoin(
        emailSenderIdentities,
        eq(emailSenderIdentities.providerConfigId, this.table.id)
      )
      .where(
        and(
          eq(emailSenderIdentities.id, senderIdentityId),
          eq(emailSenderIdentities.tenantId, tenantId),
          eq(this.table.isActive, true)
        )
      )
      .limit(1);

    return result[0]?.config as EmailProviderConfig | undefined;
  }

  /**
   * Find provider config for sender identity with credentials
   */
  async findForSenderIdentityWithCredentials(
    senderIdentityId: string,
    tenantId: string
  ): Promise<(EmailProviderConfig & { credentials?: Record<string, any> }) | undefined> {
    const config = await this.findForSenderIdentity(senderIdentityId, tenantId);
    
    if (!config) {
      // Fall back to default provider
      return this.findDefaultForTenantWithCredentials(tenantId);
    }

    return this.addDecryptedCredentials(config, tenantId);
  }

  // Private helper methods

  private async unsetDefaultForTenant(tenantId: string): Promise<void> {
    await this.db
      .update(this.table)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(
        and(
          eq(this.table.tenantId, tenantId),
          eq(this.table.isDefault, true)
        )
      );
  }

  private async addDecryptedCredentials(
    config: EmailProviderConfig, 
    tenantId: string
  ): Promise<EmailProviderConfig & { credentials?: Record<string, any> }> {
    let credentials: Record<string, any> | undefined;

    if (config.encryptedCredentials) {
      try {
        const decryptedString = await this.encryption.decrypt(
          config.encryptedCredentials, 
          tenantId
        );
        credentials = JSON.parse(decryptedString);
      } catch (error) {
        logger.error('[EmailProviderConfigRepository] Failed to decrypt credentials', {
          tenantId,
          configId: config.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Continue without credentials rather than failing
      }
    }

    return {
      ...config,
      credentials,
    };
  }
}

export const emailProviderConfigRepository = new EmailProviderConfigRepository();
```

### **OAuth Token Repository**
**File:** `server/src/repositories/entities/EmailProviderTokenRepository.ts`

```typescript
import { eq, and, lt } from 'drizzle-orm';
import { TenantAwareRepository } from '../TenantAwareRepository';
import { 
  emailProviderTokens, 
  type EmailProviderToken, 
  type NewEmailProviderToken 
} from '@/db/schema';
import { CredentialEncryption } from '@/libs/security/CredentialEncryption';
import { logger } from '@/libs/logger';

export class EmailProviderTokenRepository extends TenantAwareRepository<
  typeof emailProviderTokens,
  EmailProviderToken,
  NewEmailProviderToken
> {
  private encryption = new CredentialEncryption();
  
  constructor() {
    super(emailProviderTokens);
  }

  /**
   * Create or update OAuth tokens for a provider config
   */
  async upsertTokens(
    configId: string,
    tokens: {
      accessToken?: string;
      refreshToken?: string;
      tokenType?: string;
      expiresAt?: Date;
      scopes?: string[];
    }
  ): Promise<EmailProviderToken> {
    // Get tenant ID from config for encryption
    const tenantId = await this.getTenantIdForConfig(configId);
    
    // Encrypt tokens
    const encryptedAccessToken = tokens.accessToken 
      ? await this.encryption.encrypt(tokens.accessToken, tenantId)
      : undefined;
    
    const encryptedRefreshToken = tokens.refreshToken 
      ? await this.encryption.encrypt(tokens.refreshToken, tenantId)
      : undefined;

    // Check if tokens already exist
    const existing = await this.findByConfigId(configId);
    
    if (existing) {
      // Update existing tokens
      const result = await this.db
        .update(this.table)
        .set({
          encryptedAccessToken: encryptedAccessToken || existing.encryptedAccessToken,
          encryptedRefreshToken: encryptedRefreshToken || existing.encryptedRefreshToken,
          tokenType: tokens.tokenType || existing.tokenType,
          expiresAt: tokens.expiresAt || existing.expiresAt,
          scopes: tokens.scopes || existing.scopes,
          updatedAt: new Date(),
        })
        .where(eq(this.table.configId, configId))
        .returning();

      return result[0] as EmailProviderToken;
    } else {
      // Create new tokens
      const tokenData: NewEmailProviderToken = {
        configId,
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenType: tokens.tokenType || 'Bearer',
        expiresAt: tokens.expiresAt,
        scopes: tokens.scopes,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await this.db
        .insert(this.table)
        .values(tokenData)
        .returning();

      return result[0] as EmailProviderToken;
    }
  }

  /**
   * Get decrypted tokens for a provider config
   */
  async getDecryptedTokens(
    configId: string
  ): Promise<{
    accessToken?: string;
    refreshToken?: string;
    tokenType?: string;
    expiresAt?: Date;
    scopes?: string[];
    isExpired: boolean;
  } | undefined> {
    const tokens = await this.findByConfigId(configId);
    
    if (!tokens) {
      return undefined;
    }

    const tenantId = await this.getTenantIdForConfig(configId);
    
    let accessToken: string | undefined;
    let refreshToken: string | undefined;

    try {
      if (tokens.encryptedAccessToken) {
        accessToken = await this.encryption.decrypt(tokens.encryptedAccessToken, tenantId);
      }
      
      if (tokens.encryptedRefreshToken) {
        refreshToken = await this.encryption.decrypt(tokens.encryptedRefreshToken, tenantId);
      }
    } catch (error) {
      logger.error('[EmailProviderTokenRepository] Failed to decrypt tokens', {
        tenantId,
        configId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return undefined;
    }

    const isExpired = tokens.expiresAt ? new Date() > tokens.expiresAt : false;

    return {
      accessToken,
      refreshToken,
      tokenType: tokens.tokenType || undefined,
      expiresAt: tokens.expiresAt || undefined,
      scopes: tokens.scopes || undefined,
      isExpired,
    };
  }

  /**
   * Find tokens by config ID
   */
  async findByConfigId(configId: string): Promise<EmailProviderToken | undefined> {
    const result = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.configId, configId))
      .limit(1);

    return result[0] as EmailProviderToken | undefined;
  }

  /**
   * Delete tokens for a config
   */
  async deleteByConfigId(configId: string): Promise<boolean> {
    const result = await this.db
      .delete(this.table)
      .where(eq(this.table.configId, configId))
      .returning();

    return result.length > 0;
  }

  /**
   * Clean up expired tokens
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.db
      .delete(this.table)
      .where(lt(this.table.expiresAt, new Date()))
      .returning();

    const deletedCount = result.length;

    if (deletedCount > 0) {
      logger.info('[EmailProviderTokenRepository] Cleaned up expired tokens', {
        deletedCount,
      });
    }

    return deletedCount;
  }

  // Private helper methods

  private async getTenantIdForConfig(configId: string): Promise<string> {
    // This would need to be implemented based on your database structure
    // For now, we'll assume it's available through a join or separate query
    const result = await this.db
      .select({ tenantId: emailProviderConfigs.tenantId })
      .from(emailProviderConfigs)
      .where(eq(emailProviderConfigs.id, configId))
      .limit(1);

    if (!result[0]) {
      throw new Error(`Provider config not found: ${configId}`);
    }

    return result[0].tenantId;
  }
}

export const emailProviderTokenRepository = new EmailProviderTokenRepository();
```

### **Credential Encryption Service**
**File:** `server/src/libs/security/CredentialEncryption.ts`

```typescript
import crypto from 'crypto';
import { logger } from '@/libs/logger';

export class CredentialEncryption {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits

  /**
   * Encrypt sensitive data
   */
  async encrypt(data: string, tenantId: string): Promise<string> {
    try {
      const key = this.getEncryptionKey(tenantId);
      const iv = crypto.randomBytes(16);
      
      const cipher = crypto.createCipher(this.algorithm, key);
      cipher.setAAD(Buffer.from(tenantId)); // Additional authenticated data
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Combine IV, auth tag, and encrypted data
      const combined = iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
      
      return Buffer.from(combined).toString('base64');
    } catch (error) {
      logger.error('[CredentialEncryption] Encryption failed', {
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Failed to encrypt credentials');
    }
  }

  /**
   * Decrypt sensitive data
   */
  async decrypt(encryptedData: string, tenantId: string): Promise<string> {
    try {
      const key = this.getEncryptionKey(tenantId);
      const combined = Buffer.from(encryptedData, 'base64').toString();
      
      const [ivHex, authTagHex, encrypted] = combined.split(':');
      
      if (!ivHex || !authTagHex || !encrypted) {
        throw new Error('Invalid encrypted data format');
      }
      
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      
      const decipher = crypto.createDecipher(this.algorithm, key);
      decipher.setAAD(Buffer.from(tenantId));
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('[CredentialEncryption] Decryption failed', {
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Failed to decrypt credentials');
    }
  }

  private getEncryptionKey(tenantId: string): Buffer {
    const masterKey = process.env.EMAIL_ENCRYPTION_KEY;
    
    if (!masterKey) {
      throw new Error('EMAIL_ENCRYPTION_KEY environment variable not set');
    }
    
    // Derive tenant-specific key using PBKDF2
    return crypto.pbkdf2Sync(masterKey, tenantId, 100000, this.keyLength, 'sha256');
  }
}
```

## **Testing Requirements**

### **Unit Tests**
- [ ] Test CRUD operations for both repositories
- [ ] Test credential encryption/decryption
- [ ] Test tenant isolation
- [ ] Test default provider management
- [ ] Test error handling scenarios

### **Integration Tests**
- [ ] Test repository integration with database
- [ ] Test encryption with real data
- [ ] Test performance with large datasets

### **Test Files**
```
server/src/repositories/entities/__tests__/EmailProviderConfigRepository.test.ts
server/src/repositories/entities/__tests__/EmailProviderTokenRepository.test.ts
server/src/libs/security/__tests__/CredentialEncryption.test.ts
```

## **Security Requirements**
- [ ] Encrypt all sensitive credentials before storage
- [ ] Use tenant-specific encryption keys
- [ ] Implement secure key derivation
- [ ] Audit access to credentials
- [ ] Support credential rotation

## **Performance Considerations**
- [ ] Implement query optimization
- [ ] Add appropriate database indexes
- [ ] Consider caching for frequently accessed configs
- [ ] Optimize encryption/decryption operations

## **Documentation Requirements**
- [ ] Document all repository methods
- [ ] Include security best practices
- [ ] Document encryption strategy
- [ ] Create usage examples

## **Definition of Done**
- [ ] Both repositories implemented with all methods
- [ ] Credential encryption working securely
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] Performance benchmarks met
- [ ] Security review completed
- [ ] Documentation completed
- [ ] Code review completed

## **Notes**
- Consider database connection pooling impact
- Plan for credential rotation procedures
- Ensure proper error handling for encryption failures
- Consider audit logging for sensitive operations

## **Related Tickets**
- TICKET-007: Database Schema for Provider Configs (prerequisite)
- TICKET-006: Email Provider Factory
- TICKET-009: SendGrid Provider Implementation