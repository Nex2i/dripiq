import { eq } from 'drizzle-orm';
import { tenants, Tenant, NewTenant } from '@/db/schema';
import { NotFoundError } from '@/exceptions/error';
import { BaseRepository } from '../base/BaseRepository';

export class TenantRepository extends BaseRepository<typeof tenants, Tenant, NewTenant> {
  constructor() {
    super(tenants);
  }

  /**
   * Find tenant by name
   */
  async findByName(name: string): Promise<Tenant> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.name, name))
      .limit(1);

    if (!results[0]) {
      throw new NotFoundError(`Tenant with name ${name} not found`);
    }

    return results[0];
  }

  /**
   * Check if tenant exists by name
   */
  async existsByName(name: string): Promise<boolean> {
    const result = await this.findByName(name);
    return !!result;
  }

  /**
   * Update tenant details
   */
  async updateDetails(
    tenantId: string,
    data: {
      organizationName?: string;
      website?: string;
      summary?: string;
      differentiators?: string[];
      targetMarket?: string;
      tone?: string;
      brandColors?: string[];
      siteEmbeddingDomainId?: string;
    }
  ): Promise<Tenant | undefined> {
    return await this.updateById(tenantId, data);
  }

  /**
   * Create tenant with formatted name
   */
  async createWithFormattedName(data: Omit<NewTenant, 'name'> & { name: string }): Promise<Tenant> {
    // Auto-format tenant name: lowercase and replace spaces with hyphens
    const formattedName = data.name.toLowerCase().replace(/\s+/g, '-');

    const tenantData: NewTenant = {
      ...data,
      name: formattedName,
    };

    return await this.create(tenantData);
  }

  /**
   * Set site embedding domain for tenant
   */
  async setSiteEmbeddingDomain(
    tenantId: string,
    siteEmbeddingDomainId: string | null
  ): Promise<Tenant | undefined> {
    return await this.updateById(tenantId, { siteEmbeddingDomainId });
  }
}
