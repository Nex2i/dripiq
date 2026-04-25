import { BadRequestError, ConflictError } from '@/exceptions/error';
import { TenantDomainMappingService } from './tenant-domain-mapping.service';
import { tenantDomainMappingRepository, tenantRepository } from '@/repositories';

jest.mock('@/repositories', () => ({
  tenantDomainMappingRepository: {
    findByDomain: jest.fn(),
    findTenantByDomain: jest.fn(),
    create: jest.fn(),
  },
  tenantRepository: {
    findById: jest.fn(),
  },
}));

describe('TenantDomainMappingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('normalizeDomain', () => {
    it('normalizes email input into lowercase domain', () => {
      expect(TenantDomainMappingService.normalizeDomain('USER@Example.COM')).toBe('example.com');
    });

    it('throws for invalid domain inputs', () => {
      expect(() => TenantDomainMappingService.normalizeDomain('invalid-domain')).toThrow(
        BadRequestError
      );
    });
  });

  describe('ensureMappingForTenant', () => {
    it('returns existing mapping for same tenant', async () => {
      (tenantRepository.findById as jest.Mock).mockResolvedValue({ id: 'tenant_1' });
      (tenantDomainMappingRepository.findByDomain as jest.Mock).mockResolvedValue({
        id: 'mapping_1',
        tenantId: 'tenant_1',
        domain: 'example.com',
      });

      const result = await TenantDomainMappingService.ensureMappingForTenant({
        tenantId: 'tenant_1',
        domain: 'example.com',
      });

      expect(result.id).toBe('mapping_1');
      expect(tenantDomainMappingRepository.create).not.toHaveBeenCalled();
    });

    it('throws conflict if domain belongs to a different tenant', async () => {
      (tenantRepository.findById as jest.Mock).mockResolvedValue({ id: 'tenant_1' });
      (tenantDomainMappingRepository.findByDomain as jest.Mock).mockResolvedValue({
        id: 'mapping_1',
        tenantId: 'tenant_2',
        domain: 'example.com',
      });

      await expect(
        TenantDomainMappingService.ensureMappingForTenant({
          tenantId: 'tenant_1',
          domain: 'example.com',
        })
      ).rejects.toThrow(ConflictError);
    });

    it('creates mapping when none exists', async () => {
      (tenantRepository.findById as jest.Mock).mockResolvedValue({ id: 'tenant_1' });
      (tenantDomainMappingRepository.findByDomain as jest.Mock).mockResolvedValueOnce(undefined);
      (tenantDomainMappingRepository.create as jest.Mock).mockResolvedValue({
        id: 'mapping_2',
        tenantId: 'tenant_1',
        domain: 'example.com',
      });

      const result = await TenantDomainMappingService.ensureMappingForTenant({
        tenantId: 'tenant_1',
        domain: 'example.com',
      });

      expect(result.id).toBe('mapping_2');
      expect(tenantDomainMappingRepository.create).toHaveBeenCalledWith({
        tenantId: 'tenant_1',
        domain: 'example.com',
        isVerified: true,
      });
    });
  });
});
