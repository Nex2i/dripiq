import { TenantDomainMapping, Tenant } from '@/db';
import { tenantDomainMappingRepository, tenantRepository } from '@/repositories';
import { BadRequestError, ConflictError } from '@/exceptions/error';

export class TenantDomainMappingService {
  static normalizeDomain(value: string): string {
    const candidate = value.trim().toLowerCase();
    const withoutAtPrefix = candidate.startsWith('@') ? candidate.slice(1) : candidate;
    const domain = withoutAtPrefix.includes('@')
      ? (withoutAtPrefix.split('@').at(-1) ?? '')
      : withoutAtPrefix;

    if (!domain || domain.startsWith('.') || domain.endsWith('.') || !domain.includes('.')) {
      throw new BadRequestError('Invalid domain');
    }

    return domain;
  }

  static getDomainFromEmail(email: string): string {
    if (!email || !email.includes('@')) {
      throw new BadRequestError('Invalid email');
    }

    return this.normalizeDomain(email);
  }

  static async findTenantByDomain(domain: string): Promise<Tenant | null> {
    const normalizedDomain = this.normalizeDomain(domain);
    const tenant = await tenantDomainMappingRepository.findTenantByDomain(normalizedDomain);
    return tenant ?? null;
  }

  static async findMappingByDomain(domain: string): Promise<TenantDomainMapping | null> {
    const normalizedDomain = this.normalizeDomain(domain);
    const mapping = await tenantDomainMappingRepository.findByDomain(normalizedDomain);
    return mapping ?? null;
  }

  static async ensureMappingForTenant(params: {
    tenantId: string;
    domain: string;
    isVerified?: boolean;
  }): Promise<TenantDomainMapping> {
    const normalizedDomain = this.normalizeDomain(params.domain);
    await tenantRepository.findById(params.tenantId);

    const existing = await tenantDomainMappingRepository.findByDomain(normalizedDomain);
    if (existing) {
      if (existing.tenantId !== params.tenantId) {
        throw new ConflictError(`Domain "${normalizedDomain}" is already mapped to another tenant`);
      }
      return existing;
    }

    try {
      return await tenantDomainMappingRepository.create({
        tenantId: params.tenantId,
        domain: normalizedDomain,
        isVerified: params.isVerified ?? true,
      });
    } catch (error: any) {
      if (error?.code === '23505') {
        const mapping = await tenantDomainMappingRepository.findByDomain(normalizedDomain);
        if (mapping) {
          if (mapping.tenantId !== params.tenantId) {
            throw new ConflictError(
              `Domain "${normalizedDomain}" is already mapped to another tenant`
            );
          }
          return mapping;
        }
      }
      throw error;
    }
  }
}
