import { logger } from '@/libs/logger';
import { domainValidationRepository, tenantRepository } from '@/repositories';
import { DRIPIQ_DOMAIN_SUFFIX, NOREPLY_PREFIX } from '@/constants/email';

export interface SenderIdentityConfig {
  fromEmail: string;
  fromName: string;
  replyTo?: string;
}

/**
 * Service to resolve sender identity configuration based on domain validation rules.
 * Implements fallback logic for non-validated domains using tenant-specific addressing.
 */
export class SenderIdentityResolverService {
  /**
   * Resolves sender configuration based on domain validation status
   * @param tenantId - The tenant ID
   * @param userEmail - The user's validated email address
   * @param userName - The user's display name
   * @returns Promise<SenderIdentityConfig> - The resolved sender configuration
   */
  static async resolveSenderConfig(
    tenantId: string,
    userEmail: string,
    userName: string
  ): Promise<SenderIdentityConfig> {
    try {
      // Extract domain from user's email
      const userDomain = userEmail.getEmailDomain();
      if (!userDomain) {
        throw new Error(`Invalid email format: ${userEmail}`);
      }

      logger.info('[SenderIdentityResolver] Resolving sender config', {
        tenantId,
        userEmail,
        userName,
        userDomain,
      });

      // Check if user's domain is validated
      const isDomainValidated = await domainValidationRepository.domainExists(userDomain);

      if (isDomainValidated) {
        // Domain is validated - use user's email for both from and replyTo
        logger.info('[SenderIdentityResolver] Using validated domain', {
          tenantId,
          userDomain,
          userEmail,
        });

        return {
          fromEmail: userEmail,
          fromName: userName,
          replyTo: userEmail,
        };
      }

      // Domain is not validated - use fallback logic
      logger.info('[SenderIdentityResolver] Domain not validated, using fallback', {
        tenantId,
        userDomain,
        userEmail,
      });

      const fallbackDomain = await this.generateFallbackDomain(tenantId);

      return {
        fromEmail: `${NOREPLY_PREFIX}${fallbackDomain}${DRIPIQ_DOMAIN_SUFFIX}`,
        fromName: userName,
        replyTo: userEmail,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('[SenderIdentityResolver] Failed to resolve sender config', {
        tenantId,
        userEmail,
        userName,
        error: errorMessage,
      });

      throw new Error(`Failed to resolve sender configuration: ${errorMessage}`);
    }
  }

  /**
   * Generates a fallback domain for non-validated email domains
   * @param tenantId - The tenant ID
   * @returns Promise<string> - The fallback domain (without dripiq.ai suffix)
   */
  private static async generateFallbackDomain(tenantId: string): Promise<string> {
    try {
      // Fetch tenant information
      const tenant = await tenantRepository.findById(tenantId);
      if (!tenant) {
        throw new Error(`Tenant not found: ${tenantId}`);
      }

      // Option 1: Use tenant website domain if available
      if (tenant.website && !tenant.website.isNullOrEmpty()) {
        const websiteDomain = tenant.website.getFullDomain();
        if (websiteDomain && !websiteDomain.isNullOrEmpty()) {
          logger.info('[SenderIdentityResolver] Using tenant website domain', {
            tenantId,
            website: tenant.website,
            extractedDomain: websiteDomain,
          });
          return websiteDomain;
        }
      }

      // Option 2: Use cleaned tenant name
      if (tenant.name && !tenant.name.isNullOrEmpty()) {
        const cleanedName = tenant.name.cleanForDomain();
        if (cleanedName && !cleanedName.isNullOrEmpty()) {
          logger.info('[SenderIdentityResolver] Using cleaned tenant name', {
            tenantId,
            tenantName: tenant.name,
            cleanedName,
          });
          return cleanedName;
        }
      }

      // Option 3: Fallback to tenant ID
      logger.warn('[SenderIdentityResolver] Using tenant ID as fallback domain', {
        tenantId,
        tenantName: tenant.name,
        website: tenant.website,
      });

      return tenantId.cleanForDomain();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('[SenderIdentityResolver] Failed to generate fallback domain', {
        tenantId,
        error: errorMessage,
      });

      // Ultimate fallback - use tenant ID
      logger.warn('[SenderIdentityResolver] Using tenant ID as ultimate fallback', {
        tenantId,
      });

      return tenantId.cleanForDomain();
    }
  }
}
